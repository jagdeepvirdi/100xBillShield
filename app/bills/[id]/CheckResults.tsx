type Row = {
  id: string;
  rule: string;
  expected: number | string | null;
  actual: number | string | null;
  verdict: string;
  line_item_id: string | null;
};

const money = (value: number | string | null) => (value === null ? "-" : Number(value).toFixed(2));

// The difference is computed here in code, never by the model.
function difference(row: Row) {
  if (row.expected === null || row.actual === null) return "-";
  return (Number(row.actual) - Number(row.expected)).toFixed(2);
}

export default function CheckResults({ rows, labels }: { rows: Row[]; labels: Map<string, string> }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Check</th>
          <th>Line</th>
          <th>Expected</th>
          <th>Actual</th>
          <th>Difference</th>
          <th>Verdict</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td>{row.rule}</td>
            <td>{(row.line_item_id && labels.get(row.line_item_id)) || "-"}</td>
            <td>{money(row.expected)}</td>
            <td>{money(row.actual)}</td>
            <td>{difference(row)}</td>
            <td>{row.verdict}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
