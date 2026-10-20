import type { Fact } from "./message";

// Hard rule 3: every number in a written message must exist in the check results.

export function numbersIn(text: string): number[] {
  return (text.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((match) => Number(match.replace(/,/g, "")));
}

// Amounts, expected, actual and the code-computed difference, plus numbers inside the line's own label.
export function verifyMessage(text: string, facts: Fact[], label = ""): { ok: boolean; unknown: number[] } {
  const allowed = [
    ...facts
      .flatMap((fact) => [fact.expected, fact.actual, fact.difference])
      .filter((value): value is number => value !== null)
      .map(Math.abs),
    ...numbersIn(label),
  ];
  const unknown = numbersIn(text).filter((n) => !allowed.some((a) => Math.abs(a - n) < 0.005));
  return { ok: text.trim().length > 0 && unknown.length === 0, unknown };
}
