export type CheckRow = {
  id: string;
  rule: string;
  expected: number | string | null;
  actual: number | string | null;
  verdict: string;
  line_item_id: string | null;
};

export const money = (value: number | string | null) => (value === null ? "-" : Number(value).toFixed(2));

// The difference is computed here in code, never by the model.
export function difference(row: CheckRow) {
  if (row.expected === null || row.actual === null) return "-";
  return (Number(row.actual) - Number(row.expected)).toFixed(2);
}

export const verdictClass = (verdict: string) => `verdict verdict-${verdict}`;
