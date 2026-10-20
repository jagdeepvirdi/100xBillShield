import { ANSWER_PREFIX } from "@/lib/answers";
import { DETAIL_PREFIX, latestRun } from "@/lib/detailChecks";
import { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const COLUMNS = "id, rule, expected, actual, verdict, line_item_id, created_at";

// Three kinds of check_result rows are kept apart, so many re-runs of the checks can never push the detail
// checks or the user's answers out of view: the newest run, the detail checks, and the user's answers.
export async function loadChecks(supabase: Supabase, billId: string) {
  const rows = () => supabase.from("check_result").select(COLUMNS).eq("bill_id", billId);
  const newestFirst = { ascending: false };

  const [run, detail, answers] = await Promise.all([
    rows()
      .not("rule", "like", `${DETAIL_PREFIX}%`)
      .not("rule", "like", `${ANSWER_PREFIX}%`)
      .order("created_at", newestFirst)
      .limit(200),
    rows().like("rule", `${DETAIL_PREFIX}%`).order("created_at", newestFirst).limit(200),
    rows().like("rule", `${ANSWER_PREFIX}%`).order("created_at", newestFirst).limit(200),
  ]);

  return {
    run: latestRun(run.data ?? []),
    detail: latestRun(detail.data ?? []),
    answers: answers.data ?? [],
  };
}
