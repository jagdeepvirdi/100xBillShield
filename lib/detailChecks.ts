// Pure checks for the detailed pages of a bill. The Summary lines are what the app stores;
// each detailed block is only verified against them. No LLM, no network, whole cents.

import { TOLERANCE_CENTS, toCents, type CheckResult } from "./checks";

export const DETAIL_PREFIX = "Detail: ";
export const isDetailRule = (rule: string) => rule.startsWith(DETAIL_PREFIX);
const ROLLUP_END = ": total matches the Summary line";

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
      results.push(judge(`${DETAIL_PREFIX}${name}${ROLLUP_END}`, basis, toCents(parent.amount), parent.id));
    }
    return results;
  });
}

// The rows of one run share a created_at; the newest run is the first group.
export function latestRun<T extends { created_at: string }>(rows: T[]): T[] {
  return rows.filter((row) => row.created_at === rows[0].created_at);
}

type StoredRow = { rule: string; expected: number | string | null; actual: number | string | null; verdict: string; line_item_id: string | null };

// The detail items are not stored, so after a Summary line is edited its roll-up check is recomputed from what
// was saved: the block's total (expected) against the line's new amount. Other detail rows are left as they are.
export function refreshRollups<T extends StoredRow>(rows: T[], amounts: Map<string, number>): { rows: T[]; changed: boolean } {
  let changed = false;
  const refreshed = rows.map((row) => {
    const amount = row.line_item_id ? amounts.get(row.line_item_id) : undefined;
    if (!row.rule.endsWith(ROLLUP_END) || amount === undefined || row.expected === null) return row;
    const [expected, actual] = [toCents(Number(row.expected)), toCents(amount)];
    if (row.actual !== null && toCents(Number(row.actual)) === actual) return row;
    changed = true;
    return { ...row, actual: actual / 100, verdict: Math.abs(expected - actual) <= TOLERANCE_CENTS ? "ok" : "wrong" };
  });
  return { rows: refreshed, changed };
}
