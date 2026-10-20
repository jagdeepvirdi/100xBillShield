import { describe, expect, it } from "vitest";
import { classify, runChecks, type CheckLine, type CheckPromise } from "./checks";

const line = (label: string, amount: number): CheckLine => ({ label, amount });
const find = (results: ReturnType<typeof runChecks>, rule: string) => results.find((r) => r.rule.startsWith(rule));

const plan499 = (taxIncluded: boolean): CheckPromise => ({
  planPrice: 499,
  taxIncluded,
  discountPct: 15,
  effectiveFrom: null,
});

describe("clean bill", () => {
  // 499 plan excluding tax, 15% off, 18% GST on the discounted amount.
  const lines = [
    line("Plan charge", 499),
    line("Discount", -74.85),
    line("GST @ 18%", 76.35),
    line("Total amount due", 500.5),
  ];

  it("passes every check and shows its maths", () => {
    const results = runChecks({ lines, promise: plan499(false), previousLines: lines, periodEnd: null });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.verdict === "ok")).toBe(true);
    expect(find(results, "Tax")).toMatchObject({ expected: 76.35, actual: 76.35 });
    expect(find(results, "Sum of the lines")).toMatchObject({ expected: 500.5, actual: 500.5 });
  });
});

describe("GST on the base vs all-in", () => {
  it("flags GST charged on top of a tax-inclusive price", () => {
    // The plan is 499 with tax included, but GST was added on top of the discounted 499.
    const lines = [
      line("Plan charge", 499),
      line("Discount", -74.85),
      line("GST @ 18%", 76.35),
      line("Total amount due", 500.5),
    ];
    const results = runChecks({ lines, promise: plan499(true), previousLines: null, periodEnd: null });
    expect(find(results, "Tax")).toMatchObject({ verdict: "wrong", expected: 64.7, actual: 76.35 });
    // The arithmetic itself is fine, so the sum check passes.
    expect(find(results, "Sum of the lines")?.verdict).toBe("ok");
  });

  it("accepts GST taken out of a tax-inclusive price", () => {
    const lines = [
      line("Plan charge", 422.88),
      line("Discount", -63.43),
      line("GST @ 18%", 64.7),
      line("Total amount due", 424.15),
    ];
    const results = runChecks({ lines, promise: plan499(true), previousLines: null, periodEnd: null });
    expect(results.every((r) => r.verdict === "ok")).toBe(true);
    expect(find(results, "Tax")).toMatchObject({ expected: 64.7, actual: 64.7 });
  });

  it("flags a promised discount that is missing from the bill", () => {
    const lines = [line("Plan charge", 499), line("GST @ 18%", 89.82), line("Total amount due", 588.82)];
    const results = runChecks({ lines, promise: plan499(false), previousLines: null, periodEnd: null });
    expect(find(results, "Discount")).toMatchObject({ verdict: "wrong", expected: 74.85, actual: 0 });
  });

  it("ignores a promise that starts after the bill period", () => {
    const lines = [line("Plan charge", 499), line("GST @ 18%", 89.82), line("Total amount due", 588.82)];
    const promise = { ...plan499(false), effectiveFrom: "2026-12-01" };
    const results = runChecks({ lines, promise, previousLines: null, periodEnd: "2026-11-30" });
    expect(find(results, "Discount")).toBeUndefined();
    expect(results.every((r) => r.verdict === "ok")).toBe(true);
  });
});

describe("compared with the previous bill", () => {
  it("marks a 2.50 drop between months as unexplained, not wrong", () => {
    const previous = [line("Fixed charge", 100), line("Total amount due", 100)];
    const current = [line("Fixed charge", 97.5), line("Total amount due", 97.5)];
    const results = runChecks({ lines: current, promise: null, previousLines: previous, periodEnd: null });
    expect(find(results, "Same line")).toMatchObject({ verdict: "unexplained", expected: 100, actual: 97.5 });
    expect(results.some((r) => r.verdict === "wrong")).toBe(false);
  });

  it("marks a new line as unexplained", () => {
    const previous = [line("Fixed charge", 100), line("Total amount due", 100)];
    const current = [line("Fixed charge", 100), line("Service fee", 20), line("Total amount due", 120)];
    const results = runChecks({ lines: current, promise: null, previousLines: previous, periodEnd: null });
    expect(find(results, "New line")).toMatchObject({ verdict: "unexplained", expected: null, actual: 20 });
  });

  it("matches the same line when only the readings change", () => {
    const previous = [line("Energy 120 to 150 @ 5", 150), line("Total amount due", 150)];
    const current = [line("Energy 150 to 180 @ 5", 150), line("Total amount due", 150)];
    const results = runChecks({ lines: current, promise: null, previousLines: previous, periodEnd: null });
    expect(find(results, "Same line")?.verdict).toBe("ok");
  });
});

describe("rounding of a few paise", () => {
  it("accepts a rounding line of a few paise", () => {
    const lines = [line("Monthly charge", 99.97), line("Round off", 0.03), line("Total payable", 100)];
    const results = runChecks({ lines, promise: null, previousLines: null, periodEnd: null });
    expect(find(results, "Rounding")).toMatchObject({ verdict: "ok", expected: 0.03, actual: 0.03 });
    expect(find(results, "Sum of the lines")?.verdict).toBe("ok");
  });

  it("accepts a total that is a couple of paise off the sum", () => {
    const lines = [line("Monthly charge", 1180.02), line("Total payable", 1180)];
    const results = runChecks({ lines, promise: null, previousLines: null, periodEnd: null });
    expect(find(results, "Sum of the lines")?.verdict).toBe("ok");
  });

  it("flags a rounding line of a whole unit or more", () => {
    const lines = [line("Monthly charge", 95), line("Round off", 5), line("Total payable", 100)];
    const results = runChecks({ lines, promise: null, previousLines: null, periodEnd: null });
    expect(find(results, "Rounding")?.verdict).toBe("wrong");
  });
});

describe("other checks", () => {
  it("flags a total that is not the sum of the lines", () => {
    const lines = [line("Fixed charge", 100), line("Usage charge", 50), line("Total amount due", 140)];
    const results = runChecks({ lines, promise: null, previousLines: null, periodEnd: null });
    expect(find(results, "Sum of the lines")).toMatchObject({ verdict: "wrong", expected: 150, actual: 140 });
  });

  it("reads a discount printed without a minus sign", () => {
    const lines = [line("Fixed charge", 100), line("Discount", 10), line("Total amount due", 90)];
    const results = runChecks({ lines, promise: null, previousLines: null, periodEnd: null });
    expect(find(results, "Sum of the lines")?.verdict).toBe("ok");
  });

  it("checks meter difference times the rate", () => {
    const good = [line("Energy charge 1234 to 1290 @ 5.50", 308), line("Total amount due", 308)];
    const bad = [line("Energy charge 1234 to 1290 @ 5.50", 330), line("Total amount due", 330)];
    expect(find(runChecks({ lines: good, promise: null, previousLines: null, periodEnd: null }), "Meter")).toMatchObject({
      verdict: "ok",
      expected: 308,
    });
    expect(find(runChecks({ lines: bad, promise: null, previousLines: null, periodEnd: null }), "Meter")).toMatchObject({
      verdict: "wrong",
      expected: 308,
      actual: 330,
    });
  });

  it("checks the balance chain", () => {
    const base = [line("Previous balance", 200), line("Payment received", -50), line("Plan charge", 100)];
    const good = [...base, line("Amount due", 250)];
    const bad = [...base, line("Amount due", 300)];
    expect(find(runChecks({ lines: good, promise: null, previousLines: null, periodEnd: null }), "Balance chain")).toMatchObject({
      verdict: "ok",
    });
    expect(find(runChecks({ lines: bad, promise: null, previousLines: null, periodEnd: null }), "Balance chain")).toMatchObject({
      verdict: "wrong",
      expected: 250,
      actual: 300,
    });
  });

  it("skips checks it has no inputs for", () => {
    const results = runChecks({ lines: [line("Fixed charge", 100)], promise: null, previousLines: null, periodEnd: null });
    expect(results).toEqual([]);
  });
});

describe("classify", () => {
  it("sorts common labels", () => {
    expect(classify("CGST @ 9%")).toBe("tax");
    expect(classify("Total GST")).toBe("subtotal");
    expect(classify("Net payable")).toBe("total");
    expect(classify("Previous dues")).toBe("opening");
    expect(classify("LPG 14.2kg refill")).toBe("charge");
    expect(classify("DBTL subsidy")).toBe("subsidy");
  });
});

describe("a total printed more than once", () => {
  // Reviewer's food bill: items 203.81 plus 10.20 tax is 214.01; the printed total is 214.00.
  const bill = (totalLabel: string) => [
    line("Food items", 203.81),
    line("CGST 2.5%", 5.1),
    line("SGST 2.5%", 5.1),
    line("Sub Total", 203.81),
    line(totalLabel, 214),
    line("Grand Total", 214),
  ];
  const sumCheck = (lines: CheckLine[]) =>
    find(runChecks({ lines, promise: null, previousLines: null, periodEnd: null }), "Sum of the lines");

  it.each(["Total", "Bill Total", "Total (Rs.)", "Total Rs", "Total Value", "Net Total", "Food Total", "Total Payable"])(
    "does not count '%s' as a charge",
    (label) => {
      expect(sumCheck(bill(label))).toMatchObject({ expected: 214.01, actual: 214, verdict: "ok" });
    },
  );

  it("still treats a total discount or item count as what it says", () => {
    expect(classify("Total Discount")).toBe("discount");
    expect(classify("Total Items")).toBe("charge");
  });

  it("counts a single charge that equals the total", () => {
    const lines = [line("Plan charge", 499), line("Total amount due", 499)];
    expect(sumCheck(lines)).toMatchObject({ expected: 499, actual: 499, verdict: "ok" });
  });

  it("leaves the sum unconfirmed, with no line to dispute, when one line explains the whole gap", () => {
    const lines = [line("Service", 100), line("Fee", 50), line("Total amount due", 100)];
    const unsure = runChecks({ lines, promise: null, previousLines: null, periodEnd: null })[0];
    expect(unsure).toMatchObject({ verdict: "unexplained", expected: null, actual: null, lineId: null });
  });

  it("still reports a genuine wrong total", () => {
    const lines = [line("Service", 100), line("Fee", 37), line("Total amount due", 150)];
    expect(sumCheck(lines)).toMatchObject({ expected: 137, actual: 150, verdict: "wrong" });
  });
});

describe("electricity: rates", () => {
  const run = (lines: CheckLine[], promise: Partial<CheckPromise> | null = null) =>
    runChecks({
      lines,
      promise: promise && { planPrice: null, taxIncluded: null, discountPct: null, effectiveFrom: null, ...promise },
      previousLines: null,
      periodEnd: null,
    });
  const energy = (amount: number): CheckLine => ({ label: "Energy charges", amount, units: 150, rate: 7.5 });

  it("passes units times rate and fails a charge that does not match", () => {
    expect(find(run([energy(1125)]), "Units times")).toMatchObject({ expected: 1125, actual: 1125, verdict: "ok" });
    expect(find(run([energy(1200)]), "Units times")).toMatchObject({ expected: 1125, actual: 1200, verdict: "wrong" });
  });

  it("compares a single printed rate with the tariff the user was promised", () => {
    expect(find(run([energy(1125)], { unitRate: 7.5 }), "Printed rate")).toMatchObject({ verdict: "ok" });
    expect(find(run([energy(1125)], { unitRate: 6.5 }), "Printed rate")).toMatchObject({ expected: 6.5, actual: 7.5, verdict: "wrong" });
  });

  it("does not compare slabs with a single tariff", () => {
    const slabs: CheckLine[] = [
      { label: "Energy 0-100", amount: 400, units: 100, rate: 4 },
      { label: "Energy 100-150", amount: 300, units: 50, rate: 6 },
    ];
    expect(find(run(slabs, { unitRate: 4 }), "Printed rate")).toBeUndefined();
  });

  it("compares the fixed charge when exactly one line is a fixed charge", () => {
    const lines = [energy(1125), line("Fixed charges", 120)];
    expect(find(run(lines, { fixedCharge: 100 }), "Fixed charge")).toMatchObject({ expected: 100, actual: 120, verdict: "wrong" });
  });

  it("still checks the maths when the promise has no plan price", () => {
    const lines = [energy(1125), line("Total amount due", 1125)];
    expect(find(run(lines, { unitRate: 7.5 }), "Sum of the lines")).toMatchObject({ verdict: "ok" });
  });
});

describe("one-off bills", () => {
  const bill = [line("Tikka", 180), line("Service Charge", 18), line("CGST 2.5%", 4.95), line("SGST 2.5%", 4.95), line("Total amount due", 207.9)];
  const run = (quote: number | null) => runChecks({ lines: bill, promise: null, previousLines: null, periodEnd: null, oneOff: true, quote });

  it("asks about an extra fee instead of comparing with an earlier bill", () => {
    expect(find(run(null), "Extra fee")).toMatchObject({ verdict: "unexplained", actual: 18 });
    expect(find(run(null), "New line")).toBeUndefined();
  });

  it("compares the billed total with the quote", () => {
    expect(find(run(207.9), "Billed total")).toMatchObject({ verdict: "ok" });
    expect(find(run(190), "Billed total")).toMatchObject({ expected: 190, actual: 207.9, verdict: "wrong" });
  });
});
