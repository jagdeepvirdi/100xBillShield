import { describe, expect, it } from "vitest";
import { mostImportant, toFact, type CheckRow } from "./message";

const row = (over: Partial<CheckRow>): CheckRow => ({
  rule: "rule",
  expected: 100,
  actual: 100,
  verdict: "ok",
  line_item_id: "line-1",
  ...over,
});

describe("mostImportant", () => {
  it("returns null when every check is ok", () => {
    expect(mostImportant([row({}), row({ line_item_id: "line-2" })])).toBeNull();
  });

  it("puts a wrong line ahead of a bigger unexplained one", () => {
    const wrong = row({ verdict: "wrong", expected: 10, actual: 11, line_item_id: "a" });
    const unexplained = row({ verdict: "unexplained", expected: 10, actual: 500, line_item_id: "b" });
    expect(mostImportant([unexplained, wrong])?.line_item_id).toBe("a");
  });

  it("picks the bigger gap among equals and reads numeric strings", () => {
    const small = row({ verdict: "wrong", expected: "10.00", actual: "10.50", line_item_id: "small" });
    const big = row({ verdict: "wrong", expected: "64.70", actual: "76.35", line_item_id: "big" });
    expect(mostImportant([small, big])?.line_item_id).toBe("big");
  });

  it("treats a new line's whole amount as the gap and skips rows with no line", () => {
    const added = row({ verdict: "unexplained", expected: null, actual: 20, line_item_id: "new" });
    const unlinked = row({ verdict: "wrong", expected: 1, actual: 99, line_item_id: null });
    expect(mostImportant([unlinked, added])?.line_item_id).toBe("new");
  });
});

describe("toFact", () => {
  it("computes the difference in code", () => {
    expect(toFact(row({ expected: "64.70", actual: "76.35", verdict: "wrong" })).difference).toBe(11.65);
    expect(toFact(row({ expected: null, actual: 20 })).difference).toBeNull();
  });
});
