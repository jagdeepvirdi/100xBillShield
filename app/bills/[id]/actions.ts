"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ANSWER_DISPUTE, ANSWER_EXPECTED } from "@/lib/answers";
import { billInfoSchema } from "@/lib/billInfo";
import { runChecks } from "@/lib/checks";
import { isOneOff } from "@/lib/billTypes";
import { DETAIL_PREFIX, latestRun, refreshRollups, runDetailChecks, type DetailSection } from "@/lib/detailChecks";
import { redactLabel, redactText } from "@/lib/redact";
import { wordsChanged } from "@/lib/wordsChanged";
import { createClient } from "@/lib/supabase/server";

const detailSchema = z.object({
  name: z.string().trim().min(1).max(200),
  summaryRef: z.number().int().nonnegative().nullable(),
  items: z.array(z.number().finite()).max(1000),
  subtotal: z.number().finite().nullable(),
});

const inputSchema = z.object({
  billId: z.uuid(),
  lines: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(200),
        amount: z.number().finite(),
        ref: z.number().int().nonnegative().nullable(),
      }),
    )
    .min(1)
    .max(200),
  details: z.array(detailSchema).max(50),
  info: billInfoSchema,
});

// The bill's type, company and date as the user confirmed them; a bill the user already filled in is not
// overwritten by the reader, because the confirm screen starts from the saved values.
// Only the Summary lines become line_item rows. The detailed blocks are checked against them
// here and saved as check_result rows, so the detail itself is never stored.
export async function confirmLines(
  billId: string,
  lines: { label: string; amount: number; ref: number | null }[],
  details: DetailSection[],
  info: Record<string, string>,
): Promise<{ error?: string }> {
  const parsed = inputSchema.safeParse({ billId, lines, details, info });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Every line needs a label and a number amount." };

  const supabase = await createClient();

  // Lines are confirmed once; a second confirm would duplicate them.
  const { count } = await supabase
    .from("line_item")
    .select("id", { count: "exact", head: true })
    .eq("bill_id", parsed.data.billId);
  if (count) return { error: "This bill's lines are already confirmed." };

  const { error: infoError } = await supabase.from("bill").update(parsed.data.info).eq("id", parsed.data.billId);
  if (infoError) return { error: `Could not save the bill details: ${infoError.message}` };

  const rows = parsed.data.lines.map((line, index) => ({
    bill_id: parsed.data.billId,
    line_no: index + 1,
    label: redactLabel(line.label),
    amount: line.amount,
  }));
  const { data: saved, error } = await supabase.from("line_item").insert(rows).select("id, line_no");
  if (error || !saved) return { error: `Could not save the lines: ${error?.message}` };

  const summary = new Map<number, { id: string; amount: number }>();
  for (const line of saved) {
    const source = parsed.data.lines[(line.line_no ?? 0) - 1];
    if (source.ref !== null && !summary.has(source.ref)) summary.set(source.ref, { id: line.id, amount: source.amount });
  }
  const results = runDetailChecks(
    parsed.data.details.map((d) => ({ ...d, name: redactLabel(d.name) })),
    summary,
  );

  if (results.length > 0) {
    const { error: checkError } = await supabase.from("check_result").insert(
      results.map((r) => ({
        bill_id: parsed.data.billId,
        line_item_id: r.lineId,
        rule: r.rule,
        expected: r.expected,
        actual: r.actual,
        verdict: r.verdict,
      })),
    );
    if (checkError) {
      // Undo, so the user can confirm again instead of being stuck with half a bill.
      await supabase.from("line_item").delete().eq("bill_id", parsed.data.billId);
      return { error: `Could not save the detail checks: ${checkError.message}` };
    }
  }

  // The checks run as soon as the lines are confirmed. If none applies yet, the user can run them later.
  await insertChecks(supabase, parsed.data.billId);

  revalidatePath(`/bills/${parsed.data.billId}`);
  return {};
}

function failEdit(billId: string, message: string): never {
  redirect(`/bills/${billId}?edit_error=${encodeURIComponent(message)}`);
}

export async function updateBill(formData: FormData) {
  const billId = String(formData.get("bill_id") ?? "");
  if (!z.uuid().safeParse(billId).success) redirect("/bills");

  const parsed = billInfoSchema.safeParse({
    bill_type: formData.get("bill_type"),
    provider: formData.get("provider") ?? "",
    period_start: formData.get("period_start") ?? "",
    period_end: formData.get("period_end") ?? "",
  });
  if (!parsed.success) failEdit(billId, parsed.error.issues[0]?.message ?? "Check the details.");

  const supabase = await createClient();
  // RLS rejects the update if the bill is not the caller's.
  const { error } = await supabase.from("bill").update(parsed.data).eq("id", billId);
  if (error) failEdit(billId, `Could not save the details: ${error.message}`);

  revalidatePath("/bills");
  revalidatePath(`/bills/${billId}`);
  redirect(`/bills/${billId}`);
}

const editSchema = z.object({
  billId: z.uuid(),
  lines: z
    .array(z.object({ id: z.uuid().nullable(), label: z.string().trim().min(1).max(200), amount: z.number().finite() }))
    .min(1)
    .max(200),
});

// Corrects the confirmed lines. Lines that stay keep their id, so earlier checks and messages stay linked to them;
// the checks then run again and add a new run (earlier runs are kept).
export async function saveLines(
  billId: string,
  lines: { id: string | null; label: string; amount: number }[],
): Promise<{ error?: string }> {
  const parsed = editSchema.safeParse({ billId, lines });
  if (!parsed.success) return { error: "Every line needs a label and a number amount." };
  const supabase = await createClient();

  const { data: current } = await supabase.from("line_item").select("id, label").eq("bill_id", billId);
  if (!current?.length) return { error: "Confirm the bill lines first." };

  const ids = parsed.data.lines.flatMap((line) => (line.id ? [line.id] : []));
  const known = new Set(current.map((line) => line.id));
  if (ids.some((id) => !known.has(id)) || new Set(ids).size !== ids.length) {
    return { error: "These lines changed in the meantime. Reload the page and try again." };
  }

  const removed = current.filter((line) => !ids.includes(line.id));
  if (removed.length > 0) {
    // Removing a line also removes the checks and messages about it, so a message already sent keeps its line.
    const { data: sent } = await supabase
      .from("message")
      .select("line_item_id")
      .eq("bill_id", billId)
      .not("sent_at", "is", null)
      .in("line_item_id", removed.map((line) => line.id));
    if (sent?.length) {
      const label = removed.find((line) => line.id === sent[0].line_item_id)?.label;
      return { error: `You sent a message about "${label}", so that line has to stay.` };
    }
    const { error } = await supabase.from("line_item").delete().in("id", removed.map((line) => line.id));
    if (error) return { error: `Could not remove the lines: ${error.message}` };
  }

  const rows = parsed.data.lines.map((line, index) => ({
    id: line.id,
    line_no: index + 1,
    label: redactLabel(line.label),
    amount: line.amount,
  }));
  const updates = await Promise.all(
    rows
      .filter((row) => row.id)
      .map((row) =>
        supabase.from("line_item").update({ line_no: row.line_no, label: row.label, amount: row.amount }).eq("id", row.id!),
      ),
  );
  const failed = updates.find((update) => update.error);
  if (failed?.error) return { error: `Could not save the lines: ${failed.error.message}` };

  const added = rows.filter((row) => !row.id).map((row) => ({ bill_id: billId, line_no: row.line_no, label: row.label, amount: row.amount }));
  if (added.length > 0) {
    const { error } = await supabase.from("line_item").insert(added);
    if (error) return { error: `Could not add the lines: ${error.message}` };
  }

  await refreshDetailRollups(supabase, billId);
  await insertChecks(supabase, billId);

  revalidatePath("/bills");
  revalidatePath(`/bills/${billId}`);
  return {};
}

// The detail results were worked out against the old amounts, so they are re-saved against the corrected ones.
async function refreshDetailRollups(supabase: Supabase, billId: string) {
  const { data: stored } = await supabase
    .from("check_result")
    .select("rule, expected, actual, verdict, line_item_id, created_at")
    .eq("bill_id", billId)
    .like("rule", `${DETAIL_PREFIX}%`)
    .order("created_at", { ascending: false })
    .limit(200);
  const detail = latestRun(stored ?? []);
  if (detail.length === 0) return;

  const { data: lines } = await supabase.from("line_item").select("id, amount").eq("bill_id", billId);
  const { rows, changed } = refreshRollups(detail, new Map((lines ?? []).map((line) => [line.id, Number(line.amount)])));
  if (!changed) return;

  await supabase.from("check_result").insert(
    rows.map((row) => ({
      bill_id: billId,
      line_item_id: row.line_item_id,
      rule: row.rule,
      expected: row.expected,
      actual: row.actual,
      verdict: row.verdict,
    })),
  );
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

  // A new promise changes what the bill is checked against, so the checks run again (earlier runs are kept).
  await insertChecks(supabase, billId);

  revalidatePath(`/bills/${billId}`);
  redirect(`/bills/${billId}`);
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

function failChecks(billId: string, message: string): never {
  redirect(`/bills/${billId}?check_error=${encodeURIComponent(message)}`);
}

// The most recent earlier bill from the same provider, matched ignoring case and spaces.
async function loadPreviousLines(supabase: Supabase, bill: { provider: string | null; created_at: string }) {
  if (!bill.provider) return null;
  const provider = bill.provider.trim().toLowerCase();
  const { data: earlier } = await supabase
    .from("bill")
    .select("id, provider")
    .lt("created_at", bill.created_at)
    .order("created_at", { ascending: false })
    .limit(50);
  const previous = earlier?.find((b) => b.provider?.trim().toLowerCase() === provider);
  if (!previous) return null;

  const { data } = await supabase.from("line_item").select("label, amount").eq("bill_id", previous.id).order("line_no");
  return data?.map((l) => ({ label: l.label, amount: Number(l.amount) })) ?? null;
}

// Each run adds a new set of check_result rows; earlier runs are kept.
async function insertChecks(supabase: Supabase, billId: string): Promise<{ error?: string }> {
  const { data: bill } = await supabase
    .from("bill")
    .select("provider, bill_type, period_end, created_at")
    .eq("id", billId)
    .maybeSingle();
  if (!bill) return { error: "Bill not found." };

  const { data: lines } = await supabase
    .from("line_item")
    .select("id, label, amount")
    .eq("bill_id", billId)
    .order("line_no");
  if (!lines?.length) return { error: "Confirm the bill lines first." };

  const { data: promise } = await supabase
    .from("promise")
    .select("plan_price, tax_included, discount, effective_from")
    .eq("bill_id", billId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const results = runChecks({
    lines: lines.map((l) => ({ id: l.id, label: l.label, amount: Number(l.amount) })),
    promise: promise && {
      planPrice: promise.plan_price === null ? null : Number(promise.plan_price),
      taxIncluded: promise.tax_included,
      discountPct: promise.discount === null ? null : Number(promise.discount),
      effectiveFrom: promise.effective_from,
    },
    previousLines: isOneOff(bill.bill_type) ? null : await loadPreviousLines(supabase, bill),
    periodEnd: bill.period_end,
  });
  if (results.length === 0) {
    return { error: "No check applies yet: the lines have no total, no tax rate and there is no earlier bill to compare." };
  }

  const { error } = await supabase.from("check_result").insert(
    results.map((r) => ({
      bill_id: billId,
      line_item_id: r.lineId,
      rule: r.rule,
      expected: r.expected,
      actual: r.actual,
      verdict: r.verdict,
    })),
  );
  if (error) return { error: `Could not save the checks: ${error.message}` };
  return {};
}

export async function runBillChecks(formData: FormData) {
  const billId = String(formData.get("bill_id") ?? "");
  if (!z.uuid().safeParse(billId).success) redirect("/bills");

  const supabase = await createClient();
  const { error } = await insertChecks(supabase, billId);
  if (error) failChecks(billId, error);

  revalidatePath(`/bills/${billId}`);
  redirect(`/bills/${billId}`);
}

const answerSchema = z.object({
  bill_id: z.uuid(),
  line_item_id: z.uuid(),
  answer: z.enum(["expected", "dispute"]),
});

// The user's answer about an unexplained line is added as its own row, so an earlier answer is kept and
// the newest one counts.
export async function answerLine(formData: FormData) {
  const parsed = answerSchema.safeParse({
    bill_id: formData.get("bill_id"),
    line_item_id: formData.get("line_item_id"),
    answer: formData.get("answer"),
  });
  if (!parsed.success) redirect("/bills");
  const { bill_id: billId, line_item_id: lineId, answer } = parsed.data;

  const supabase = await createClient();
  // RLS rejects the insert if the bill or line is not the caller's.
  const { error } = await supabase.from("check_result").insert({
    bill_id: billId,
    line_item_id: lineId,
    rule: answer === "expected" ? ANSWER_EXPECTED : ANSWER_DISPUTE,
    expected: null,
    actual: null,
    verdict: answer === "expected" ? "ok" : "wrong",
  });
  if (error) failChecks(billId, `Could not save your answer: ${error.message}`);

  revalidatePath("/bills");
  revalidatePath(`/bills/${billId}`);
  redirect(`/bills/${billId}`);
}

const sentSchema = z.object({
  messageId: z.uuid(),
  sentText: z.string().trim().min(1).max(5000),
});

// Records what the user actually sent. sent_at is set on the first save; later edits keep it.
export async function saveSent(messageId: string, sentText: string): Promise<{ error?: string }> {
  const parsed = sentSchema.safeParse({ messageId, sentText });
  if (!parsed.success) return { error: "Paste or type the text you sent." };

  const supabase = await createClient();
  const { data: message } = await supabase
    .from("message")
    .select("draft, sent_at, bill_id")
    .eq("id", parsed.data.messageId)
    .maybeSingle();
  if (!message) return { error: "Message not found." };

  // Account numbers, phone numbers and the like are never stored, even when the user sent them.
  const sent = redactText(parsed.data.sentText);
  if (!sent) return { error: "Paste or type the text you sent." };

  const { error } = await supabase
    .from("message")
    .update({
      sent_text: sent,
      sent_at: message.sent_at ?? new Date().toISOString(),
      words_changed: wordsChanged(message.draft, sent),
    })
    .eq("id", parsed.data.messageId);
  if (error) return { error: `Could not save: ${error.message}` };

  revalidatePath(`/bills/${message.bill_id}`);
  return {};
}

export async function deleteBill(formData: FormData) {
  const billId = z.uuid().safeParse(formData.get("bill_id"));
  if (!billId.success) redirect("/bills");

  const supabase = await createClient();

  const { data: bill } = await supabase.from("bill").select("image_link").eq("id", billId.data).maybeSingle();
  if (!bill) redirect("/bills");

  // Child rows go with the bill (on delete cascade).
  const { error } = await supabase.from("bill").delete().eq("id", billId.data);
  if (error) redirect(`/bills/${billId.data}?delete_error=${encodeURIComponent("Could not delete the bill.")}`);

  // The row is gone either way; a failed file removal only leaves an unreferenced photo.
  if (bill.image_link) await supabase.storage.from("bill-images").remove([bill.image_link]);

  revalidatePath("/bills");
  redirect("/bills");
}
