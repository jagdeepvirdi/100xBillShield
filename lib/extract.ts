import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

export const extractedLinesSchema = z.array(
  z.object({
    label: z.string().trim().min(1),
    amount: z.number().finite(),
  }),
);

export type ExtractedLine = z.infer<typeof extractedLinesSchema>[number];

const PROMPT = `Read this bill and list every charge, tax, discount, subsidy, rounding and total line exactly as printed.
Reply with ONLY a JSON array, no prose and no code fences: [{ "label": string, "amount": number }].
Rules:
- Copy each amount exactly as printed. Do not add, subtract, convert or correct anything.
- Use a negative amount for discounts, credits and subsidies.
- Leave out account numbers, customer or consumer ids, phone numbers and addresses.
- If the file is not a bill or nothing is readable, reply with [].`;

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const MIME_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
};

function parseLines(text: string): ExtractedLine[] {
  const json = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return extractedLinesSchema.parse(JSON.parse(json));
}

async function readWithClaude(signedUrl: string, storagePath: string): Promise<ExtractedLine[]> {
  const client = new Anthropic();
  const isPdf = storagePath.toLowerCase().endsWith(".pdf");

  const response = await client.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 8000,
    messages: [
      {
        role: "user",
        content: [
          isPdf
            ? { type: "document", source: { type: "url", url: signedUrl } }
            : { type: "image", source: { type: "url", url: signedUrl } },
          { type: "text", text: PROMPT },
        ],
      },
    ],
  });

  if (response.stop_reason !== "end_turn") {
    throw new Error(`Model stopped early (${response.stop_reason}).`);
  }
  const text = response.content.find((block) => block.type === "text");
  if (!text || text.type !== "text") throw new Error("Model returned no text.");
  return parseLines(text.text);
}

// Gemini cannot fetch our signed URL, so the server downloads the file and sends it inline.
async function readWithGemini(signedUrl: string, storagePath: string): Promise<ExtractedLine[]> {
  const mimeType = MIME_TYPES[storagePath.split(".").pop()?.toLowerCase() ?? ""];
  if (!mimeType) throw new Error("Unsupported file type.");

  const file = await fetch(signedUrl);
  if (!file.ok) throw new Error(`Could not download the bill (${file.status}).`);
  const data = Buffer.from(await file.arrayBuffer()).toString("base64");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY!,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ inline_data: { mime_type: mimeType, data } }, { text: PROMPT }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0 },
      }),
    },
  );
  if (!response.ok) throw new Error(`Gemini request failed (${response.status}).`);

  const body = await response.json();
  const text = body?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") throw new Error("Gemini returned no text.");
  return parseLines(text);
}

// The model reads the file through a short-lived signed URL; it never computes anything.
// Gemini is used only when Claude cannot be called (no key, credits used up, rate limit, outage).
export async function readBillLines(signedUrl: string, storagePath: string): Promise<ExtractedLine[]> {
  const geminiAvailable = Boolean(process.env.GEMINI_API_KEY);

  if (!process.env.ANTHROPIC_API_KEY) {
    if (!geminiAvailable) throw new Error("No LLM key is configured.");
    return readWithGemini(signedUrl, storagePath);
  }

  try {
    return await readWithClaude(signedUrl, storagePath);
  } catch (error) {
    const claudeUnavailable =
      error instanceof Anthropic.APIError || error instanceof Anthropic.APIConnectionError;
    if (!claudeUnavailable || !geminiAvailable) throw error;
    console.warn("Claude unavailable, falling back to Gemini:", error.message);
    return readWithGemini(signedUrl, storagePath);
  }
}
