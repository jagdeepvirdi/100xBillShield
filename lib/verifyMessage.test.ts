import { describe, expect, it } from "vitest";
import { templateMessage, type Fact } from "./message";
import { numbersIn, verifyMessage } from "./verifyMessage";

const taxFact: Fact = {
  rule: "Tax at the printed rate on the promised taxable amount",
  expected: 64.7,
  actual: 76.35,
  difference: 11.65,
  verdict: "wrong",
};

describe("numbersIn", () => {
  it("reads amounts with commas and ignores a trailing full stop", () => {
    expect(numbersIn("Rs. 1,234.50 and 76.35.")).toEqual([1234.5, 76.35]);
  });
});

describe("verifyMessage", () => {
  it("accepts a message that uses only the check results", () => {
    const text = "Hello, GST is 76.35 but should be 64.70, a gap of 11.65. Thank you";
    expect(verifyMessage(text, [taxFact], "GST @ 18%")).toEqual({ ok: true, unknown: [] });
  });

  it("rejects an amount that is not in the check results", () => {
    const text = "Hello, you overcharged me by 12.50. Thank you";
    expect(verifyMessage(text, [taxFact])).toEqual({ ok: false, unknown: [12.5] });
  });

  it("rejects dates, phone numbers and a number the model computed itself", () => {
    expect(verifyMessage("Please reply by 25/10/2026", [taxFact]).ok).toBe(false);
    expect(verifyMessage("Call me on 98765 43210", [taxFact]).ok).toBe(false);
    expect(verifyMessage("The bill is 76.35 which is 11.64 too high", [taxFact]).unknown).toEqual([11.64]);
  });

  it("allows numbers that are part of the line's own label", () => {
    const text = 'Hello, about "LPG 14.2kg refill": it shows 76.35. Thank you';
    expect(verifyMessage(text, [taxFact], "LPG 14.2kg refill").ok).toBe(true);
  });

  it("rejects an empty message", () => {
    expect(verifyMessage("   ", [taxFact]).ok).toBe(false);
  });
});

describe("templateMessage", () => {
  const changed: Fact = { rule: "Same line as on the previous bill", expected: 100, actual: 97.5, difference: -2.5, verdict: "unexplained" };
  const added: Fact = { rule: "New line compared with the previous bill", expected: null, actual: 20, difference: null, verdict: "unexplained" };

  it.each([
    ["wrong", taxFact, "76.35", "64.70", "11.65"],
    ["changed", changed, "100.00", "97.50", "100.00"],
    ["new", added, "20.00", "20.00", "20.00"],
  ])("builds a %s message that passes its own verification", (_name, fact, ...mentioned) => {
    const text = templateMessage("Fixed charge", fact);
    mentioned.forEach((amount) => expect(text).toContain(amount));
    expect(verifyMessage(text, [fact], "Fixed charge").ok).toBe(true);
  });
});
