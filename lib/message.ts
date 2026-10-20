// Pure helpers for the message step: pick the line to dispute, shape the facts, build the fallback text.

type Money = number | string | null;

export type CheckRow = {
  rule: string;
  expected: Money;
  actual: Money;
  verdict: string;
  line_item_id: string | null;
};

// What the model is allowed to see and use. Every number here was computed by code.
export type Fact = {
  rule: string;
  expected: number | null;
  actual: number | null;
  difference: number | null;
  verdict: string;
};

const num = (value: Money) => (value === null ? null : Number(value));
const fmt = (n: number) => n.toFixed(2);

function size(row: CheckRow): number {
  const [expected, actual] = [num(row.expected), num(row.actual)];
  if (actual === null) return 0;
  return Math.abs(expected === null ? actual : actual - expected);
}

// The single most important issue: a wrong line beats an unexplained one, then the bigger gap wins.
// Only rows tied to a line item qualify, because a message must point at the line it disputes.
export function mostImportant<T extends CheckRow>(rows: T[]): T | null {
  const issues = rows.filter((row) => row.verdict !== "ok" && row.line_item_id);
  issues.sort((a, b) => Number(b.verdict === "wrong") - Number(a.verdict === "wrong") || size(b) - size(a));
  return issues[0] ?? null;
}

export function toFact(row: CheckRow): Fact {
  const [expected, actual] = [num(row.expected), num(row.actual)];
  return {
    rule: row.rule,
    expected,
    actual,
    difference: expected !== null && actual !== null ? Math.round((actual - expected) * 100) / 100 : null,
    verdict: row.verdict,
  };
}

// Plain message built by code, used when the model's wording cannot be verified.
export function templateMessage(label: string, fact: Fact): string {
  const { expected, actual, difference } = fact;
  let issue: string;

  if (fact.verdict === "wrong" && expected !== null && actual !== null && difference !== null) {
    issue = `The bill shows ${fmt(actual)} but it should be ${fmt(expected)}, a difference of ${fmt(Math.abs(difference))} (${fact.rule}).`;
  } else if (expected !== null && actual !== null) {
    issue = `This line was ${fmt(expected)} on my previous bill and is ${fmt(actual)} now, and I was not told why.`;
  } else if (actual !== null) {
    issue = `This is a new charge of ${fmt(actual)} that was not on my previous bill, and I was not told what it is for.`;
  } else {
    issue = "I do not understand this line.";
  }

  return [
    "Hello,",
    "",
    `I am writing about the charge "${label}" on my latest bill. ${issue}`,
    "",
    "Please check it and send me a corrected bill or an explanation.",
    "",
    "Thank you",
  ].join("\n");
}
