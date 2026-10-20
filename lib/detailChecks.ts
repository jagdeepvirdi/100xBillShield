// Pure checks for the detailed pages of a bill. The Summary lines are what the app stores;
// each detailed block is only verified against them. No LLM, no network, whole cents.

import { TOLERANCE_CENTS, toCents, type CheckResult } from "./checks";

export const DETAIL_PREFIX = "Detail: ";
export const isDetailRule = (rule: string) => rule.startsWith(DETAIL_PREFIX);

// summaryRef points at the Summary line this block explains; null when none matches.
export type DetailSection = { name: string; summaryRef: number | null; items: number[]; subtotal: number | null };
export type SummaryLineRef = { id?: string; amount: number };

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

function judge(rule: string, expected: number, actual: number, lineId?: string): CheckResult {
  return {
    rule,
    expected: expected / 100,
    actual: actual / 100,
    verdict: Math.abs(expected - actual) <= TOLERANCE_CENTS ? "ok" : "wrong",
    lineId: lineId ?? null,
  };
}

// 1. The items add up to the subtotal printed for the block.
// 2. The block's total (printed subtotal, else the items' sum) equals the Summary line it explains.
export function runDetailChecks(sections: DetailSection[], summary: Map<number, SummaryLineRef>): CheckResult[] {
  return sections.flatMap((section) => {
    if (section.items.length === 0 && section.subtotal === null) return [];

    const name = section.name.slice(0, 60);
    const parent = section.summaryRef === null ? undefined : summary.get(section.summaryRef);
    const itemsCents = sum(section.items.map(toCents));
    const basis = section.subtotal === null ? itemsCents : toCents(section.subtotal);

    const results: CheckResult[] = [];
    if (section.subtotal !== null) {
      results.push(judge(`${DETAIL_PREFIX}${name}: items add up to the printed subtotal`, itemsCents, basis, parent?.id));
    }
    if (parent) {
      results.push(judge(`${DETAIL_PREFIX}${name}: total matches the Summary line`, basis, toCents(parent.amount), parent.id));
    }
    return results;
  });
}

// The rows of one run share a created_at; the newest run is the first group.
export function latestRun<T extends { created_at: string }>(rows: T[]): T[] {
  return rows.filter((row) => row.created_at === rows[0].created_at);
}
