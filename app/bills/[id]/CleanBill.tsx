import { difference, money, type CheckRow } from "./checkFormat";

// Shown when every check passed: the maths, one line per check. No message is written for a clean bill.
export default function CleanBill({ rows, labels }: { rows: CheckRow[]; labels: Map<string, string> }) {
  return (
    <div>
      <h3>Every line checks out</h3>
      <p>
        {rows.length} {rows.length === 1 ? "check" : "checks"} ran on this bill and all passed, so there is nothing to
        dispute and no message to send.
      </p>
      <ul>
        {rows.map((row) => {
          const label = row.line_item_id ? labels.get(row.line_item_id) : null;
          return (
            <li key={row.id}>
              {row.rule}
              {label ? ` (${label})` : ""}: expected {money(row.expected)}, actual {money(row.actual)}, difference{" "}
              {difference(row)}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
