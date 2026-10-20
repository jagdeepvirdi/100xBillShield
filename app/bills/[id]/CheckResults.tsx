import { difference, money, verdictClass, type CheckRow } from "./checkFormat";

export default function CheckResults({ rows, labels }: { rows: CheckRow[]; labels: Map<string, string> }) {
  return (
    <div className="table-wrap">
      <table className="wide">
        <thead>
          <tr>
            <th>Check</th>
            <th>Line</th>
            <th className="num">Expected</th>
            <th className="num">Actual</th>
            <th className="num">Difference</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.rule}</td>
              <td>{(row.line_item_id && labels.get(row.line_item_id)) || "-"}</td>
              <td className="num">{money(row.expected)}</td>
              <td className="num">{money(row.actual)}</td>
              <td className="num">{difference(row)}</td>
              <td>
                <span className={verdictClass(row.verdict)}>{row.verdict}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
