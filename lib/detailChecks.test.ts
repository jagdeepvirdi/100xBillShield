import { describe, expect, it } from "vitest";
import { runDetailChecks, type DetailSection } from "./detailChecks";

const summary = new Map([
  [0, { id: "monthly", amount: 499 }],
  [1, { id: "usage", amount: 0 }],
  [2, { id: "addons", amount: 120 }],
]);

describe("detail checks", () => {
  it("passes a zero-usage block that rolls up to a zero Summary line", () => {
    const usage: DetailSection = { name: "Usage", summaryRef: 1, items: [0, 0, 0], subtotal: 0 };
    const results = runDetailChecks([usage], summary);
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.verdict === "ok")).toBe(true);
  });

  it("passes usage that is charged and then discounted to the Summary amount", () => {
    const usage: DetailSection = { name: "Usage", summaryRef: 1, items: [30, 12.5, -42.5], subtotal: 0 };
    expect(runDetailChecks([usage], summary).every((r) => r.verdict === "ok")).toBe(true);
  });

  it("flags items that do not add up to the printed subtotal", () => {
    const addons: DetailSection = { name: "Add-ons", summaryRef: 2, items: [99, 20], subtotal: 120 };
    const [adds] = runDetailChecks([addons], summary);
    expect(adds).toMatchObject({ verdict: "wrong", expected: 119, actual: 120, lineId: "addons" });
  });

  it("flags a Summary line that differs from the block total", () => {
    const addons: DetailSection = { name: "Add-ons", summaryRef: 2, items: [100, 30], subtotal: 130 };
    const results = runDetailChecks([addons], summary);
    expect(results[0].verdict).toBe("ok");
    expect(results[1]).toMatchObject({ verdict: "wrong", expected: 130, actual: 120, lineId: "addons" });
  });

  it("treats a few paise as rounding", () => {
    const addons: DetailSection = { name: "Add-ons", summaryRef: 2, items: [60.02, 60], subtotal: null };
    expect(runDetailChecks([addons], summary)).toMatchObject([{ verdict: "ok" }]);
  });

  it("checks only the items against the subtotal when no Summary line matches", () => {
    const calls: DetailSection = { name: "Calls", summaryRef: null, items: [1, 2], subtotal: 3 };
    expect(runDetailChecks([calls], summary)).toMatchObject([{ verdict: "ok", lineId: null }]);
  });

  it("skips a block with nothing to check", () => {
    expect(runDetailChecks([{ name: "Empty", summaryRef: 0, items: [], subtotal: null }], summary)).toEqual([]);
  });
});
