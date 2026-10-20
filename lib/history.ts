import { classify, keyOf } from "./checks";

export type EarlierLine = {
  billId: string;
  date: string; // ISO timestamp, used to order bills newest first
  provider: string | null;
  label: string;
  amount: number;
};

export type HistoryEntry = { billId: string; date: string; provider: string | null; amount: number };

export type LineHistory = {
  lineId: string;
  label: string;
  amount: number;
  earlier: HistoryEntry[]; // newest first
  change: number | null; // this bill minus the most recent earlier bill
};

const COMPARABLE = ["charge", "tax", "discount", "subsidy"];
const MAX_EARLIER = 6;

// Same label across the user's earlier bills. Digits and punctuation are ignored, as in the checks,
// so "Energy 120 to 150" matches "Energy 150 to 180". Totals, balances and rounding are left out.
export function lineHistories(
  current: { id: string; label: string; amount: number }[],
  earlier: EarlierLine[],
): LineHistory[] {
  const byBill = new Map<string, EarlierLine[]>();
  for (const line of earlier) byBill.set(line.billId, [...(byBill.get(line.billId) ?? []), line]);
  const bills = [...byBill.values()].sort((a, b) => b[0].date.localeCompare(a[0].date));

  const seen = new Map<string, number>();
  const result: LineHistory[] = [];

  for (const line of current) {
    if (!COMPARABLE.includes(classify(line.label))) continue;
    const key = keyOf(line.label);
    const nth = seen.get(key) ?? 0;
    seen.set(key, nth + 1);

    const entries = bills
      .map((lines) => {
        const match = lines.filter((l) => keyOf(l.label) === key)[nth];
        return match && { billId: match.billId, date: match.date, provider: match.provider, amount: match.amount };
      })
      .filter((entry): entry is HistoryEntry => Boolean(entry))
      .slice(0, MAX_EARLIER);
    if (entries.length === 0) continue;

    result.push({
      lineId: line.id,
      label: line.label,
      amount: line.amount,
      earlier: entries,
      change: Math.round((line.amount - entries[0].amount) * 100) / 100,
    });
  }
  return result;
}
