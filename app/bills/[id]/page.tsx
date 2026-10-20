import { notFound } from "next/navigation";
import { isDetailRule, latestRun } from "@/lib/detailChecks";
import { lineHistories } from "@/lib/history";
import { createClient } from "@/lib/supabase/server";
import BillView from "./BillView";
import { loadEarlierLines } from "./loadEarlier";

export default async function BillPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ promise_error?: string; check_error?: string; delete_error?: string }>;
}) {
  const { id } = await params;
  const { promise_error, check_error, delete_error } = await searchParams;
  const supabase = await createClient();

  // RLS hides other users' bills, so a foreign or bad id gives no row.
  const { data: bill } = await supabase
    .from("bill")
    .select("id, provider, bill_type, period_start, period_end, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!bill) notFound();

  const { data: lines } = await supabase
    .from("line_item")
    .select("id, label, amount")
    .eq("bill_id", id)
    .order("line_no");

  // Promises are never overwritten; the newest one is the one in force.
  const { data: promise } = await supabase
    .from("promise")
    .select("plan_price, tax_included, discount, effective_from, notes")
    .eq("bill_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Every run is kept; the rows of one run share a created_at, so the newest run is the first group.
  // Detail checks are saved once when the lines are confirmed, so they are kept apart from the runs.
  const { data: checkRows } = await supabase
    .from("check_result")
    .select("id, rule, expected, actual, verdict, line_item_id, created_at")
    .eq("bill_id", id)
    .order("created_at", { ascending: false })
    .limit(200);
  const latestChecks = latestRun((checkRows ?? []).filter((row) => !isDetailRule(row.rule)));
  const detailChecks = latestRun((checkRows ?? []).filter((row) => isDetailRule(row.rule)));

  const histories = lineHistories(
    (lines ?? []).map((line) => ({ id: line.id, label: line.label, amount: Number(line.amount) })),
    await loadEarlierLines(supabase, bill.created_at),
  );

  const { data: message } = await supabase
    .from("message")
    .select("id, draft, sent_text, sent_at, words_changed")
    .eq("bill_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <BillView
      bill={bill}
      lines={lines ?? []}
      promise={promise}
      checks={latestChecks}
      detailChecks={detailChecks}
      histories={histories}
      message={message}
      promiseError={promise_error}
      checkError={check_error}
      deleteError={delete_error}
    />
  );
}
