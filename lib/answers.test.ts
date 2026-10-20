import { describe, expect, it } from "vitest";
import { ANSWER_DISPUTE, ANSWER_EXPECTED, latestAnswers, questionFor, resolveChecks, type ResultRow } from "./answers";

const row = (verdict: string, lineId: string | null): ResultRow => ({
  rule: "Same line as on the previous bill",
  expected: 100,
  actual: 102.5,
  verdict,
  line_item_id: lineId,
  created_at: "2026-10-20T10:00:00Z",
});
const answer = (rule: string, lineId: string, at: string) => ({ rule, line_item_id: lineId, created_at: at });

describe("resolving unexplained lines", () => {
  it("waits for the user when nothing is answered", () => {
    expect(resolveChecks([row("unexplained", "a")], [])[0].state).toBe("pending");
  });

  it("counts a line the user expected as ok", () => {
    const answers = [answer(ANSWER_EXPECTED, "a", "2026-10-20T10:05:00Z")];
    expect(resolveChecks([row("unexplained", "a")], answers)[0].state).toBe("ok");
  });

  it("turns a line the user does not accept into a dispute", () => {
    const answers = [answer(ANSWER_DISPUTE, "a", "2026-10-20T10:05:00Z")];
    expect(resolveChecks([row("unexplained", "a")], answers)[0].state).toBe("disputed");
  });

  it("uses the newest answer, so a wrong click can be changed", () => {
    const answers = [
      answer(ANSWER_DISPUTE, "a", "2026-10-20T10:05:00Z"),
      answer(ANSWER_EXPECTED, "a", "2026-10-20T10:09:00Z"),
    ];
    expect(latestAnswers(answers).get("a")).toBe("expected");
  });

  it("keeps ok and wrong as they are and never asks about a total with no line", () => {
    const states = resolveChecks([row("ok", "a"), row("wrong", "b"), row("unexplained", null)], []).map((r) => r.state);
    expect(states).toEqual(["ok", "wrong", "unconfirmed"]);
  });
});

describe("questions", () => {
  it("asks about a new charge", () => {
    expect(questionFor({ expected: null, actual: 45 }, "Delivery fee")).toBe(
      '"Delivery fee" is a new charge of 45.00. It was not on your previous bill. Were you expecting it?',
    );
  });

  it("asks about a changed charge", () => {
    expect(questionFor({ expected: 100, actual: 102.5 }, "Energy")).toContain(
      "was 100.00 on your previous bill and is 102.50 now",
    );
  });
});
