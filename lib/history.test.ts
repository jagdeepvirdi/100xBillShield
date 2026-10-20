import { describe, expect, it } from "vitest";
import { lineHistories, type EarlierLine } from "./history";

const now = (id: string, label: string, amount: number) => ({ id, label, amount });
const before = (billId: string, date: string, label: string, amount: number): EarlierLine => ({
  billId,
  date,
  provider: "Acme",
  label,
  amount,
});

describe("lineHistories", () => {
  const earlier = [
    before("b1", "2026-08-01T00:00:00Z", "Fixed charge", 100),
    before("b2", "2026-09-01T00:00:00Z", "Fixed charge", 100),
    before("b2", "2026-09-01T00:00:00Z", "Total amount due", 100),
  ];

  it("lists the same label across earlier bills, newest first, with the change from the latest", () => {
    const [history] = lineHistories([now("l1", "Fixed charge", 97.5)], earlier);
    expect(history.earlier.map((e) => e.billId)).toEqual(["b2", "b1"]);
    expect(history.earlier.map((e) => e.amount)).toEqual([100, 100]);
    expect(history.change).toBe(-2.5);
  });

  it("reports no change for a charge that repeats", () => {
    expect(lineHistories([now("l1", "Fixed charge", 100)], earlier)[0].change).toBe(0);
  });

  it("matches when only the numbers in the label differ", () => {
    const old = [before("b1", "2026-09-01T00:00:00Z", "Energy 120 to 150 @ 5", 150)];
    const [history] = lineHistories([now("l1", "Energy 150 to 180 @ 5", 150)], old);
    expect(history.earlier).toHaveLength(1);
  });

  it("skips new lines, totals and bills without a match", () => {
    const result = lineHistories([now("l1", "Service fee", 20), now("l2", "Total amount due", 120)], earlier);
    expect(result).toEqual([]);
  });

  it("pairs repeated labels in order", () => {
    const old = [
      before("b1", "2026-09-01T00:00:00Z", "Late fee", 10),
      before("b1", "2026-09-01T00:00:00Z", "Late fee", 20),
    ];
    const result = lineHistories([now("l1", "Late fee", 10), now("l2", "Late fee", 25)], old);
    expect(result.map((h) => [h.earlier[0].amount, h.change])).toEqual([
      [10, 0],
      [20, 5],
    ]);
  });

  it("keeps at most six earlier bills per line", () => {
    const many = Array.from({ length: 9 }, (_, i) => before(`b${i}`, `2026-0${i + 1}-01T00:00:00Z`, "Fixed charge", 100));
    expect(lineHistories([now("l1", "Fixed charge", 100)], many)[0].earlier).toHaveLength(6);
  });
});
