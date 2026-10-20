import { resolveChecks, type AnswerRow, type ResultRow } from "./answers";

export type BillStatus = "unread" | "unchecked" | "needs_answer" | "unconfirmed" | "verified" | "error" | "sent";

// One status per bill, worked out from what is stored. `run` is the newest check run, `detail` the detail checks.
export function billStatus(input: {
  lineCount: number;
  run: ResultRow[];
  detail: ResultRow[];
  answers: AnswerRow[];
  sent: boolean;
}): BillStatus {
  if (input.lineCount === 0) return "unread";
  if (input.run.length === 0 && input.detail.length === 0) return "unchecked";

  const rows = resolveChecks([...input.detail, ...input.run], input.answers);
  if (rows.some((row) => row.state === "wrong" || row.state === "disputed")) return input.sent ? "sent" : "error";
  if (rows.some((row) => row.state === "pending")) return "needs_answer";
  if (rows.some((row) => row.state === "unconfirmed")) return "unconfirmed";
  return input.run.length === 0 ? "unchecked" : "verified";
}
