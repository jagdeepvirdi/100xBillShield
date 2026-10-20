"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { redactLabel } from "@/lib/redact";
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
