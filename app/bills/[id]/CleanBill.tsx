import { difference, money, ruleText, type CheckRow } from "./checkFormat";

// Shown when every check passed: the maths, one line per check. No message is written for a clean bill.
export default function CleanBill({ rows, labels }: { rows: CheckRow[]; labels: Map<string, string> }) {
  return (
    <div className="stack">
      <p>
        <span className="verdict verdict-ok">Every line checks out</span>
      </p>
      <p className="muted">
        {rows.length} {rows.length === 1 ? "check" : "checks"} ran on this bill and all passed, so there is nothing to
        dispute and no message to send.
      </p>
      <ul className="plain">
        {rows.map((row) => {
          const label = row.line_item_id ? labels.get(row.line_item_id) : null;
          return (
            <li key={row.id}>
              <div>
                {ruleText(row)}
                {label ? ` (${label})` : ""}
              </div>
              <div className="muted">
                Expected {money(row.expected)}, actual {money(row.actual)}, difference {difference(row)}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
