import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { BILL_TYPES, type BillType } from "@/lib/billTypes";
import { geminiGenerate, withFallback } from "@/lib/llm";
import { withImpliedRates } from "@/lib/rates";

// units and rate are only filled when the bill prints them for that line; the model never works them out.
const lineSchema = z.object({
  label: z.string().trim().min(1),
  amount: z.number().finite(),
  units: z.number().finite().nonnegative().nullable().catch(null).default(null),
  rate: z.number().finite().nonnegative().nullable().catch(null).default(null),
});

// Anything the model gets wrong or leaves out becomes null; the user can fill it in on the confirm screen.
const billSchema = z.object({
  bill_type: z.enum(BILL_TYPES).nullable().catch(null),
  provider: z.string().trim().min(1).nullable().catch(null),
  period_start: z.iso.date().nullable().catch(null),
  period_end: z.iso.date().nullable().catch(null),
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
export type ExtractedInfo = { billType: BillType | null; provider: string | null; periodStart: string | null; periodEnd: string | null };
export type ExtractedBill = { info: ExtractedInfo; lines: ExtractedLine[]; details: ExtractedDetail[] };

const PROMPT = `You are reading a bill or receipt. First work out what it is, then read its lines.

About the bill:
- bill_type: one of ${BILL_TYPES.map((t) => `"${t}"`).join(", ")}. Use "restaurant" for food and drink bills, "shopping" for shop or online purchases, "receipt" for any other one-off purchase, and "other" only when nothing else fits. Use null if you cannot tell.
- provider: the name of the company, shop or restaurant that issued it, as printed (no address, no phone number). null if not printed.
- period_start and period_end: the billing period as YYYY-MM-DD. For a one-off purchase put the bill date in both. null if no date is printed.

About the lines: many bills have a SUMMARY (what the customer is actually charged: plan or monthly charge, add-ons, usage charge, discounts, taxes, rounding, total, amount due) and then DETAILED pages (itemised usage, call or data records, add-on breakdowns) that explain parts of the summary.

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
- units: the quantity for a line when the bill prints it (kWh or units of electricity, litres, cylinders, nights), otherwise null. rate: the price per unit as printed, otherwise null. Never calculate either one.
- Leave out account numbers, customer or consumer ids, phone numbers and addresses.
- If the file is not a bill or nothing is readable, reply with {"bill_type": null, "provider": null, "period_start": null, "period_end": null, "summary": [], "details": []}.
Reply with ONLY JSON, no prose and no code fences:
{"bill_type":string|null,"provider":string|null,"period_start":string|null,"period_end":string|null,"summary":[{"label":string,"amount":number,"units":number|null,"rate":number|null}],"details":[{"name":string,"summary_index":number|null,"items":[{"label":string,"amount":number,"units":number|null,"rate":number|null}],"subtotal":number|null}]}`;

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
  const datesOk = !(bill.period_start && bill.period_end && bill.period_end < bill.period_start);
  return {
    info: {
      billType: bill.bill_type,
      provider: bill.provider,
      periodStart: datesOk ? bill.period_start : null,
      periodEnd: datesOk ? bill.period_end : null,
    },
    lines: withImpliedRates(
      bill.summary,
      bill.details.map((d) => ({ summaryIndex: d.summary_index, items: d.items })),
    ),
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
