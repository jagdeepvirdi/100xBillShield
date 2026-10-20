"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { redactLabel, redactText } from "@/lib/redact";
import { createClient } from "@/lib/supabase/server";

const inputSchema = z.object({
  billId: z.uuid(),
  lines: z
    .array(z.object({ label: z.string().trim().min(1).max(200), amount: z.number().finite() }))
    .min(1)
    .max(200),
});

export async function confirmLines(
  billId: string,
  lines: { label: string; amount: number }[],
): Promise<{ error?: string }> {
  const parsed = inputSchema.safeParse({ billId, lines });
  if (!parsed.success) return { error: "Every line needs a label and a number amount." };

  const supabase = await createClient();

  // Lines are confirmed once; a second confirm would duplicate them.
  const { count } = await supabase
    .from("line_item")
    .select("id", { count: "exact", head: true })
    .eq("bill_id", parsed.data.billId);
  if (count) return { error: "This bill's lines are already confirmed." };

  const rows = parsed.data.lines.map((line, index) => ({
    bill_id: parsed.data.billId,
    line_no: index + 1,
    label: redactLabel(line.label),
    amount: line.amount,
  }));
  const { error } = await supabase.from("line_item").insert(rows);
  if (error) return { error: `Could not save the lines: ${error.message}` };

  revalidatePath(`/bills/${parsed.data.billId}`);
  return {};
}

const optionalNumber = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : Number(v)))
  .refine((v) => v === null || (Number.isFinite(v) && v >= 0 && v < 1e9), "Enter a valid number.");

const promiseSchema = z.object({
  bill_id: z.uuid(),
  plan_price: optionalNumber.refine((v) => v !== null, "Enter the plan price."),
  tax_included: z.enum(["yes", "no"]).transform((v) => v === "yes"),
  discount: optionalNumber.refine((v) => v === null || v <= 100, "Discount is a percentage, 0 to 100."),
  effective_from: z.union([z.literal("").transform(() => null), z.iso.date()]),
  notes: z.string().trim().max(1000).transform((v) => redactText(v) || null),
});

function failPromise(billId: string, message: string): never {
  redirect(`/bills/${billId}?promise_error=${encodeURIComponent(message)}`);
}

export async function savePromise(formData: FormData) {
  const billId = String(formData.get("bill_id") ?? "");
  const parsed = promiseSchema.safeParse({
    bill_id: billId,
    plan_price: formData.get("plan_price") ?? "",
    tax_included: formData.get("tax_included"),
    discount: formData.get("discount") ?? "",
    effective_from: formData.get("effective_from") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) {
    if (!z.uuid().safeParse(billId).success) redirect("/bills");
    failPromise(billId, parsed.error.issues[0].message);
  }

  const supabase = await createClient();
  // RLS rejects the insert if the bill is not the caller's.
  const { error } = await supabase.from("promise").insert(parsed.data);
  if (error) failPromise(billId, `Could not save the promise: ${error.message}`);

  revalidatePath(`/bills/${billId}`);
  redirect(`/bills/${billId}`);
}
