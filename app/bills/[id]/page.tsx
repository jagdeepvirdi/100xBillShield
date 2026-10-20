import { notFound } from "next/navigation";
import { isOneOff } from "@/lib/billTypes";
import { latestAnswers, questionFor, resolveChecks } from "@/lib/answers";
import { billStatus } from "@/lib/billStatus";
import { lineHistories } from "@/lib/history";
import { createClient } from "@/lib/supabase/server";
import BillView from "./BillView";
import { loadChecks } from "../loadChecks";
import { loadEarlierLines } from "./loadEarlier";

export default async function BillPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ promise_error?: string; check_error?: string; delete_error?: string; edit_error?: string }>;
}) {
  const { id } = await params;
  const { promise_error, check_error, delete_error, edit_error } = await searchParams;
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

  // Every run is kept; the newest run, the detail checks and the user's answers are loaded apart.
  const { run, detail, answers } = await loadChecks(supabase, id);
  const checks = resolveChecks(run, answers);
  const detailChecks = resolveChecks(detail, answers);
  const answerFor = latestAnswers(answers);
  const labelOf = new Map((lines ?? []).map((line) => [line.id, line.label]));

  // Unexplained lines are asked about, once per line. Answered ones stay listed so they can be changed.
  const unexplained = [...detailChecks, ...checks].filter((row) => row.verdict === "unexplained" && row.line_item_id);
  const questions = unexplained
    .filter((row) => row.state === "pending")
    .map((row) => ({ lineId: row.line_item_id!, text: questionFor(row, labelOf.get(row.line_item_id!) ?? "This charge") }))
    .filter((q, i, all) => all.findIndex((other) => other.lineId === q.lineId) === i);
  const answered = unexplained
    .filter((row) => row.state !== "pending")
    .map((row) => ({ lineId: row.line_item_id!, label: labelOf.get(row.line_item_id!) ?? "This charge", answer: answerFor.get(row.line_item_id!)! }))
    .filter((a, i, all) => all.findIndex((other) => other.lineId === a.lineId) === i);

  const histories = isOneOff(bill.bill_type)
    ? []
    : lineHistories(
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

  const { data: sentMessage } = await supabase
    .from("message")
    .select("sent_at")
    .eq("bill_id", id)
    .not("sent_at", "is", null)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const status = billStatus({
    lineCount: lines?.length ?? 0,
    run,
    detail,
    answers,
    sent: Boolean(sentMessage),
  });

  return (
    <BillView
      bill={bill}
      lines={lines ?? []}
      promise={promise}
      checks={checks}
      detailChecks={detailChecks}
      status={status}
      sentAt={sentMessage?.sent_at ?? null}
      questions={questions}
      answered={answered}
      histories={histories}
      message={message}
      promiseError={promise_error}
      checkError={check_error}
      deleteError={delete_error}
      editError={edit_error}
    />
  );
}
