import { difference, money, type CheckRow } from "./checkFormat";

export default function CheckResults({ rows, labels }: { rows: CheckRow[]; labels: Map<string, string> }) {
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
