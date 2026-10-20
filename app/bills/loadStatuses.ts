import { ANSWER_PREFIX, type AnswerRow, type ResultRow } from "@/lib/answers";
import { billStatus, type BillStatus } from "@/lib/billStatus";
import { DETAIL_PREFIX, latestRun } from "@/lib/detailChecks";
import { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type CheckRow = ResultRow & { bill_id: string };

const PAGE = 1000;
const MAX_PAGES = 20;

// PostgREST returns at most 1000 rows a request, so read page by page.
async function allRows<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const rows: T[] = [];
  for (let i = 0; i < MAX_PAGES; i++) {
    const { data } = await page(i * PAGE, (i + 1) * PAGE - 1);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

function groupByBill<T extends { bill_id: string }>(rows: T[]) {
  const groups = new Map<string, T[]>();
  for (const row of rows) groups.set(row.bill_id, [...(groups.get(row.bill_id) ?? []), row]);
  return groups;
}

// A status for every one of the user's bills (RLS limits every query to the caller's rows).
export async function loadStatuses(supabase: Supabase): Promise<Map<string, BillStatus>> {
  const [checks, lines, sent] = await Promise.all([
    allRows<CheckRow>((from, to) =>
      supabase
        .from("check_result")
        .select("bill_id, rule, expected, actual, verdict, line_item_id, created_at")
        .order("created_at", { ascending: false })
        .range(from, to),
    ),
    allRows<{ bill_id: string }>((from, to) =>
      supabase.from("line_item").select("bill_id").order("created_at", { ascending: false }).range(from, to),
    ),
    allRows<{ bill_id: string }>((from, to) =>
      supabase
        .from("message")
        .select("bill_id")
        .not("sent_at", "is", null)
        .order("created_at", { ascending: false })
        .range(from, to),
    ),
  ]);

  const checksByBill = groupByBill(checks);
  const lineCounts = new Map<string, number>();
  for (const line of lines) lineCounts.set(line.bill_id, (lineCounts.get(line.bill_id) ?? 0) + 1);
  const sentBills = new Set(sent.map((message) => message.bill_id));

  const statuses = new Map<string, BillStatus>();
  const billIds = new Set([...lineCounts.keys(), ...checksByBill.keys()]);
  for (const billId of billIds) {
    const rows = checksByBill.get(billId) ?? [];
    const run = rows.filter((r) => !r.rule.startsWith(DETAIL_PREFIX) && !r.rule.startsWith(ANSWER_PREFIX));
    const detail = rows.filter((r) => r.rule.startsWith(DETAIL_PREFIX));
    const answers: AnswerRow[] = rows.filter((r) => r.rule.startsWith(ANSWER_PREFIX));
    statuses.set(
      billId,
      billStatus({
        lineCount: lineCounts.get(billId) ?? 0,
        run: latestRun(run),
        detail: latestRun(detail),
        answers,
        sent: sentBills.has(billId),
      }),
    );
  }
  return statuses;
}
