// Pure bill checks: no LLM, no network. All money maths is done in whole cents.
// Lines are classified by label keywords; a check that cannot find its inputs is skipped, never guessed.

export type Verdict = "ok" | "wrong" | "unexplained";

export type CheckLine = { id?: string; label: string; amount: number };

export type CheckPromise = {
  planPrice: number | null;
  taxIncluded: boolean | null;
  discountPct: number | null;
  effectiveFrom: string | null;
};

export type CheckInput = {
  lines: CheckLine[];
  promise: CheckPromise | null;
  previousLines: CheckLine[] | null;
  periodEnd: string | null;
};

export type CheckResult = {
  rule: string;
  expected: number | null;
  actual: number | null;
  verdict: Verdict;
  lineId: string | null;
};

type Kind =
  | "total"
  | "current_total"
  | "subtotal"
  | "opening"
  | "payment"
  | "rounding"
  | "subsidy"
  | "discount"
  | "tax"
  | "charge";

type Classified = CheckLine & { kind: Kind; cents: number };

// Differences up to 5 paise are rounding, not errors.
const TOLERANCE_CENTS = 5;
const TAX_WORDS = /\b(gst|cgst|sgst|igst|vat|tax|cess)\b/;
const READINGS = /(\d+(?:\.\d+)?)\s*(?:to|-|–|→)\s*(\d+(?:\.\d+)?)/i;
const RATE = /@\s*(?:rs\.?|₹)?\s*(\d+(?:\.\d+)?)/i;

const toCents = (n: number) => Math.round(n * 100);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const close = (a: number, b: number) => Math.abs(a - b) <= TOLERANCE_CENTS;

export function classify(label: string): Kind {
  const l = label.toLowerCase();
  if (/sub\s*-?\s*total/.test(l) || (/total/.test(l) && TAX_WORDS.test(l))) return "subtotal";
  if (/\b(payment|paid|received|receipt)\b/.test(l)) return "payment";
  if (/\b(previous|opening|prior|arrears?|b\/f|brought forward)\b/.test(l)) return "opening";
  if (/\b(current (charges|bill|month)|this month|total charges|bill amount|current total)\b/.test(l)) {
    return "current_total";
  }
  if (
    /\b(net payable|amount (due|payable)|total (due|payable|amount|bill)|grand total|payable amount|amount to pay|net amount|closing)\b/.test(l) ||
    /^\s*total\s*$/.test(l)
  ) {
    return "total";
  }
  if (/\bround(ing|ed)?\b/.test(l)) return "rounding";
  if (/\bsubsid(y|ies)\b|\bdbtl\b/.test(l)) return "subsidy";
  if (/\b(discount|rebate|waiver|cashback)\b/.test(l)) return "discount";
  if (TAX_WORDS.test(l)) return "tax";
  return "charge";
}

function result(
  rule: string,
  expected: number | null,
  actual: number | null,
  verdict: Verdict,
  lineId?: string,
): CheckResult {
  return {
    rule,
    expected: expected === null ? null : expected / 100,
    actual: actual === null ? null : actual / 100,
    verdict,
    lineId: lineId ?? null,
  };
}

const judge = (rule: string, expected: number, actual: number, lineId?: string) =>
  result(rule, expected, actual, close(expected, actual) ? "ok" : "wrong", lineId);

const reducing = (l: Classified) => l.kind === "discount" || l.kind === "subsidy";

// Discounts and subsidies may be printed with or without a minus sign; use the reading that fits the target.
function pickSum(current: Classified[], target: number): number {
  const printed = sum(current.map((l) => l.cents));
  const flipped = sum(current.map((l) => (reducing(l) ? -Math.abs(l.cents) : l.cents)));
  return Math.abs(printed - target) <= Math.abs(flipped - target) ? printed : flipped;
}

const ofKind = (lines: Classified[], ...kinds: Kind[]) => lines.filter((l) => kinds.includes(l.kind));

function sumChecks(lines: Classified[]): CheckResult[] {
  const total = ofKind(lines, "total").at(-1);
  if (!total) return [];
  const currentTotal = ofKind(lines, "current_total").at(-1);
  const opening = ofKind(lines, "opening");
  const payments = ofKind(lines, "payment");
  const current = ofKind(lines, "charge", "tax", "discount", "subsidy", "rounding");

  if (opening.length === 0 && payments.length === 0) {
    const target = currentTotal ?? total;
    return [judge("Sum of the lines vs the printed total", pickSum(current, target.cents), target.cents, target.id)];
  }

  const out: CheckResult[] = [];
  if (currentTotal) {
    out.push(
      judge(
        "Sum of the charge lines vs the printed current charges",
        pickSum(current, currentTotal.cents),
        currentTotal.cents,
        currentTotal.id,
      ),
    );
  }
  const openingC = sum(opening.map((l) => l.cents));
  const paidC = sum(payments.map((l) => Math.abs(l.cents)));
  const currentC = currentTotal ? currentTotal.cents : pickSum(current, total.cents - openingC + paidC);
  out.push(
    judge(
      "Balance chain: opening balance plus charges minus payments vs the closing amount",
      openingC - paidC + currentC,
      total.cents,
      total.id,
    ),
  );
  return out;
}

// The tax rate is read from the bill's own tax labels (for example CGST 9% and SGST 9%).
function taxRate(lines: Classified[]): number | null {
  const pcts = ofKind(lines, "tax")
    .map((l) => l.label.match(/(\d+(?:\.\d+)?)\s*%/)?.[1])
    .filter((p): p is string => Boolean(p))
    .map(Number);
  return pcts.length ? sum(pcts) / 100 : null;
}

function activePromise(promise: CheckPromise | null, periodEnd: string | null): CheckPromise | null {
  if (!promise || promise.planPrice === null) return null;
  if (promise.effectiveFrom && periodEnd && promise.effectiveFrom > periodEnd) return null;
  return promise;
}

// The plan line is the charge that equals the promised price, before or after the discount,
// and, when the price includes tax, either with or without the tax.
function findPlanLine(charges: Classified[], promise: CheckPromise, rate: number | null) {
  const plan = promise.planPrice!;
  const afterDiscount = 1 - (promise.discountPct ?? 0) / 100;
  const prices = promise.taxIncluded && rate ? [plan, plan / (1 + rate)] : [plan];
  for (const line of charges) {
    if (prices.some((p) => close(line.cents, toCents(p)))) return { line, discounted: false };
    if (afterDiscount < 1 && prices.some((p) => close(line.cents, toCents(p * afterDiscount)))) {
      return { line, discounted: true };
    }
  }
  return null;
}

function taxCheck(lines: Classified[], promise: CheckPromise | null, rate: number | null): CheckResult[] {
  const taxLines = ofKind(lines, "tax");
  const charges = ofKind(lines, "charge");
  if (rate === null || taxLines.length === 0 || charges.length === 0) return [];

  const actual = sum(taxLines.map((l) => l.cents));
  const planLine = promise && promise.taxIncluded !== null ? findPlanLine(charges, promise, rate) : null;

  if (promise && planLine) {
    const discounted = promise.planPrice! * (1 - (promise.discountPct ?? 0) / 100);
    const base = promise.taxIncluded ? discounted / (1 + rate) : discounted;
    const extras = sum(charges.filter((c) => c !== planLine.line).map((c) => c.cents)) / 100;
    const expected = Math.round((base + extras) * rate * 100);
    return [judge("Tax at the printed rate on the promised taxable amount", expected, actual, taxLines[0].id)];
  }

  const billedBase = sum(charges.map((c) => c.cents)) - sum(ofKind(lines, "discount").map((d) => Math.abs(d.cents)));
  return [
    judge("Tax at the printed rate on the billed taxable amount", Math.round(billedBase * rate), actual, taxLines[0].id),
  ];
}

function discountCheck(lines: Classified[], promise: CheckPromise | null, rate: number | null): CheckResult[] {
  const pct = promise?.discountPct;
  if (!promise || !pct) return [];
  const planLine = findPlanLine(ofKind(lines, "charge"), promise, rate);
  if (!planLine) return [];

  if (planLine.discounted) {
    const { cents, id } = planLine.line;
    return [result("Discount already included in the plan charge", cents, cents, "ok", id)];
  }
  const discounts = ofKind(lines, "discount");
  const expected = Math.round((planLine.line.cents * pct) / 100);
  const actual = sum(discounts.map((d) => Math.abs(d.cents)));
  return [judge("Discount vs the promised percentage of the plan charge", expected, actual, (discounts[0] ?? planLine.line).id)];
}

function roundingChecks(lines: Classified[]): CheckResult[] {
  const rest = sum(
    ofKind(lines, "charge", "tax", "discount", "subsidy").map((l) => (reducing(l) ? -Math.abs(l.cents) : l.cents)),
  );
  const expected = Math.round(rest / 100) * 100 - rest;
  return ofKind(lines, "rounding").map((l) =>
    result("Rounding adjustment is under one unit", expected, l.cents, Math.abs(l.cents) < 100 ? "ok" : "wrong", l.id),
  );
}

function meterChecks(lines: Classified[]): CheckResult[] {
  return ofKind(lines, "charge").flatMap((l) => {
    const readings = l.label.match(READINGS);
    const rate = l.label.match(RATE);
    if (!readings || !rate) return [];
    const [from, to] = [Number(readings[1]), Number(readings[2])];
    if (to < from) return [];
    const expected = Math.round((to - from) * Number(rate[1]) * 100);
    return [judge("Meter reading difference times the rate vs the charge", expected, l.cents, l.id)];
  });
}

// Digits and punctuation are dropped so "Energy 120 to 150" matches "Energy 150 to 180".
const keyOf = (label: string) => label.toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();

function previousChecks(lines: Classified[], previousLines: CheckLine[] | null): CheckResult[] {
  if (!previousLines?.length) return [];
  const comparable = (l: Classified) => ["charge", "tax", "discount", "subsidy"].includes(l.kind);
  const pool = classifyAll(previousLines).filter(comparable);

  return lines.filter(comparable).map((l) => {
    const index = pool.findIndex((p) => keyOf(p.label) === keyOf(l.label));
    if (index === -1) return result("New line compared with the previous bill", null, l.cents, "unexplained", l.id);
    const [previous] = pool.splice(index, 1);
    return result(
      "Same line as on the previous bill",
      previous.cents,
      l.cents,
      close(previous.cents, l.cents) ? "ok" : "unexplained",
      l.id,
    );
  });
}

function classifyAll(lines: CheckLine[]): Classified[] {
  return lines.map((l) => ({ ...l, kind: classify(l.label), cents: toCents(l.amount) }));
}

export function runChecks(input: CheckInput): CheckResult[] {
  const lines = classifyAll(input.lines);
  const rate = taxRate(lines);
  const promise = activePromise(input.promise, input.periodEnd);

  return [
    ...sumChecks(lines),
    ...taxCheck(lines, promise, rate),
    ...discountCheck(lines, promise, rate),
    ...roundingChecks(lines),
    ...meterChecks(lines),
    ...previousChecks(lines, input.previousLines),
  ];
}
