// A line that is new or changed since the previous bill is "unexplained": the maths is right, so only the
// user knows whether it is fine. Their answer is saved as an extra check_result row (never an overwrite),
// and this file turns raw check rows plus answers into what the screen shows. No LLM, no network.

export const ANSWER_PREFIX = "Answer: ";
export const ANSWER_EXPECTED = `${ANSWER_PREFIX}expected`;
export const ANSWER_DISPUTE = `${ANSWER_PREFIX}dispute`;
export const isAnswerRule = (rule: string) => rule.startsWith(ANSWER_PREFIX);

export type Answer = "expected" | "dispute";
type Money = number | string | null;

export type ResultRow = {
  rule: string;
  expected: Money;
  actual: Money;
  verdict: string;
  line_item_id: string | null;
  created_at: string;
};
export type AnswerRow = { rule: string; line_item_id: string | null; created_at: string };

// ok: fine. wrong: contradicts the maths or the promise. disputed: the user said no to an unexplained line.
// pending: waiting for the user's answer. unconfirmed: a total that could not be confirmed, tied to no line.
export type State = "ok" | "wrong" | "disputed" | "pending" | "unconfirmed";

// The newest answer for each line wins, so a wrong click can be changed.
export function latestAnswers(rows: AnswerRow[]): Map<string, Answer> {
  const answers = new Map<string, Answer>();
  const oldestFirst = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));
  for (const row of oldestFirst) {
    if (row.line_item_id) answers.set(row.line_item_id, row.rule === ANSWER_EXPECTED ? "expected" : "dispute");
  }
  return answers;
}

export function resolveChecks<T extends ResultRow>(rows: T[], answerRows: AnswerRow[]): (T & { state: State })[] {
  const answers = latestAnswers(answerRows);
  return rows.map((row) => {
    if (row.verdict === "ok") return { ...row, state: "ok" };
    if (row.verdict === "wrong") return { ...row, state: "wrong" };
    if (!row.line_item_id) return { ...row, state: "unconfirmed" };
    const answer = answers.get(row.line_item_id);
    return { ...row, state: answer === "expected" ? "ok" : answer === "dispute" ? "disputed" : "pending" };
  });
}

const fmt = (value: Money) => Number(value).toFixed(2);

// The question is built by code from the check's own numbers; no model is involved.
export function questionFor(row: { expected: Money; actual: Money }, label: string): string {
  if (row.expected === null && row.actual !== null) {
    return `"${label}" is a new charge of ${fmt(row.actual)}. It was not on your previous bill. Were you expecting it?`;
  }
  if (row.expected !== null && row.actual !== null) {
    return `"${label}" was ${fmt(row.expected)} on your previous bill and is ${fmt(row.actual)} now. Were you expecting this change?`;
  }
  return `Were you expecting "${label}"?`;
}
