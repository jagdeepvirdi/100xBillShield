import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { geminiGenerate, withFallback } from "@/lib/llm";

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

  const text = await geminiGenerate([{ inline_data: { mime_type: mimeType, data } }, { text: PROMPT }], {
    responseMimeType: "application/json",
    temperature: 0,
  });
  return parseLines(text);
}

// The model reads the file through a short-lived signed URL; it never computes anything.
export function readBillLines(signedUrl: string, storagePath: string): Promise<ExtractedLine[]> {
  return withFallback(
    () => readWithClaude(signedUrl, storagePath),
    () => readWithGemini(signedUrl, storagePath),
  );
}
