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

function stripFences(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}

// The model reads the file through a short-lived signed URL; it never computes anything.
export async function readBillLines(signedUrl: string, storagePath: string): Promise<ExtractedLine[]> {
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

  return extractedLinesSchema.parse(JSON.parse(stripFences(text.text)));
}
