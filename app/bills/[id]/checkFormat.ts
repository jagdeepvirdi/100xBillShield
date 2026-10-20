import type { State } from "@/lib/answers";

export type CheckRow = {
  id: string;
  rule: string;
  expected: number | string | null;
  actual: number | string | null;
  verdict: string;
  line_item_id: string | null;
  state: State;
};

export const money = (value: number | string | null) => (value === null ? "-" : Number(value).toFixed(2));

// The difference is computed here in code, never by the model.
export function difference(row: CheckRow) {
  if (row.expected === null || row.actual === null) return "-";
  return (Number(row.actual) - Number(row.expected)).toFixed(2);
}

export const verdictClass = (verdict: string) => `verdict verdict-${verdict}`;

// What the table shows for a resolved check. The word "unexplained" is never shown: those lines are asked
// about, and after the answer they read as ok or disputed.
const STATE_LABEL = { ok: "ok", wrong: "wrong", disputed: "disputed", pending: "waiting", unconfirmed: "not confirmed" };
const STATE_CLASS = { ok: "ok", wrong: "wrong", disputed: "unexplained", pending: "unexplained", unconfirmed: "unexplained" };
// An unexplained line that counts as ok is one the user said they expected.
export const ruleText = (row: CheckRow) => (row.verdict === "unexplained" && row.state === "ok" ? `${row.rule} (you expected this)` : row.rule);
export const stateLabel = (row: CheckRow) => STATE_LABEL[row.state];
export const isUnconfirmed = (row: CheckRow) => row.state === "unconfirmed";
export const stateClass = (row: CheckRow) => `verdict verdict-${STATE_CLASS[row.state]}`;
