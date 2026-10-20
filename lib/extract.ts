import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { geminiGenerate, withFallback } from "@/lib/llm";

const lineSchema = z.object({
  label: z.string().trim().min(1),
  amount: z.number().finite(),
});

const billSchema = z.object({
  summary: z.array(lineSchema),
  details: z
    .array(
      z.object({
        name: z.string().trim().min(1),
        summary_index: z.number().int().nonnegative().nullable(),
        items: z.array(lineSchema),
        subtotal: z.number().finite().nullable(),
      }),
    )
    .default([]),
});

export type ExtractedLine = z.infer<typeof lineSchema>;
export type ExtractedDetail = { name: string; summaryIndex: number | null; items: ExtractedLine[]; subtotal: number | null };
export type ExtractedBill = { lines: ExtractedLine[]; details: ExtractedDetail[] };

const PROMPT = `You are reading a bill. Many bills have a SUMMARY (what the customer is actually charged: plan or monthly charge, add-ons, usage charge, discounts, taxes, rounding, total, amount due) and then DETAILED pages (itemised usage, call or data records, add-on breakdowns) that explain parts of the summary.

1. Find the summary. Put its lines in "summary", exactly as printed, in order.
2. Do NOT copy detailed pages into "summary". For each detailed block, add one entry to "details":
   - name: the block's heading.
   - summary_index: the 0-based position in "summary" of the line this block explains, or null if no summary line matches.
   - items: every charge, discount or credit amount in the block with its label. If every item in the block is 0.00, use an empty list.
   - subtotal: the total printed for the block, or null if none is printed.
3. If the bill has no separate summary, put every line in "summary" and use an empty "details" list.

Rules:
- Copy each amount exactly as printed. Do not add, subtract, convert or correct anything.
- Use a negative amount for discounts, credits and subsidies.
- Leave out account numbers, customer or consumer ids, phone numbers and addresses.
- If the file is not a bill or nothing is readable, reply with {"summary": [], "details": []}.
Reply with ONLY JSON, no prose and no code fences:
{"summary":[{"label":string,"amount":number}],"details":[{"name":string,"summary_index":number|null,"items":[{"label":string,"amount":number}],"subtotal":number|null}]}`;

const MIME_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
};

function parseBill(text: string): ExtractedBill {
  const json = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const raw = JSON.parse(json);
  // An older-style flat list is treated as a bill with only a summary.
  const bill = billSchema.parse(Array.isArray(raw) ? { summary: raw } : raw);
  return {
    lines: bill.summary,
    details: bill.details.map((d) => ({
      name: d.name,
      summaryIndex: d.summary_index !== null && d.summary_index < bill.summary.length ? d.summary_index : null,
      items: d.items,
      subtotal: d.subtotal,
    })),
  };
}

async function readWithClaude(signedUrl: string, storagePath: string): Promise<ExtractedBill> {
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
  return parseBill(text.text);
}

// Gemini cannot fetch our signed URL, so the server downloads the file and sends it inline.
async function readWithGemini(signedUrl: string, storagePath: string): Promise<ExtractedBill> {
  const mimeType = MIME_TYPES[storagePath.split(".").pop()?.toLowerCase() ?? ""];
  if (!mimeType) throw new Error("Unsupported file type.");

  const file = await fetch(signedUrl);
  if (!file.ok) throw new Error(`Could not download the bill (${file.status}).`);
  const data = Buffer.from(await file.arrayBuffer()).toString("base64");

  const text = await geminiGenerate([{ inline_data: { mime_type: mimeType, data } }, { text: PROMPT }], {
    responseMimeType: "application/json",
    temperature: 0,
  });
  return parseBill(text);
}

// The model reads the file through a short-lived signed URL; it never computes anything.
export function readBill(signedUrl: string, storagePath: string): Promise<ExtractedBill> {
  return withFallback(
    () => readWithClaude(signedUrl, storagePath),
    () => readWithGemini(signedUrl, storagePath),
  );
}
