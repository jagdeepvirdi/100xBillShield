import { describe, expect, it } from "vitest";
import { ANSWER_DISPUTE, ANSWER_EXPECTED, type ResultRow } from "./answers";
import { billStatus } from "./billStatus";

const row = (verdict: string, lineId: string | null = "a"): ResultRow => ({
  rule: "r",
  expected: 1,
  actual: 1,
  verdict,
  line_item_id: lineId,
  created_at: "2026-10-20T10:00:00Z",
});
const base = { lineCount: 3, run: [row("ok")], detail: [], answers: [], sent: false };
const answer = (rule: string) => ({ rule, line_item_id: "a", created_at: "2026-10-20T11:00:00Z" });

describe("bill status", () => {
  it("is unread without lines and unchecked without results", () => {
    expect(billStatus({ ...base, lineCount: 0 })).toBe("unread");
    expect(billStatus({ ...base, run: [] })).toBe("unchecked");
  });

  it("is verified when every check is ok", () => {
    expect(billStatus(base)).toBe("verified");
  });

  it("needs an answer for an unanswered unexplained line, and is verified once it was expected", () => {
    const run = [row("ok", "b"), row("unexplained")];
    expect(billStatus({ ...base, run })).toBe("needs_answer");
    expect(billStatus({ ...base, run, answers: [answer(ANSWER_EXPECTED)] })).toBe("verified");
  });

  it("is an error for a wrong line or a disputed one, and sent once the message was sent", () => {
    expect(billStatus({ ...base, run: [row("wrong")] })).toBe("error");
    const disputed = { ...base, run: [row("unexplained")], answers: [answer(ANSWER_DISPUTE)] };
    expect(billStatus(disputed)).toBe("error");
    expect(billStatus({ ...disputed, sent: true })).toBe("sent");
  });

  it("is verified again when a later run passes, even though a message was sent", () => {
    expect(billStatus({ ...base, sent: true })).toBe("verified");
  });

  it("does not claim verified when a total could not be confirmed", () => {
    expect(billStatus({ ...base, run: [row("ok"), row("unexplained", null)] })).toBe("unconfirmed");
  });
});
