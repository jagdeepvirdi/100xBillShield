import type { LineHistory } from "@/lib/history";

const formatDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB");

function changeText(change: number | null) {
  if (change === null) return "-";
  if (change === 0) return "same";
  return `${change > 0 ? "+" : ""}${change.toFixed(2)}`;
}

// The same charge across earlier bills, so one that repeats or changes is easy to see.
export default function EarlierBills({ histories }: { histories: LineHistory[] }) {
  return (
    <section>
      <h2>Earlier bills</h2>
      <table>
        <thead>
          <tr>
            <th>Line</th>
            <th>This bill</th>
            <th>Change since last bill</th>
            <th>Earlier bills, newest first</th>
          </tr>
        </thead>
        <tbody>
          {histories.map((h) => (
            <tr key={h.lineId}>
              <td>{h.label}</td>
              <td>{h.amount.toFixed(2)}</td>
              <td>{changeText(h.change)}</td>
              <td>
                {h.earlier
                  .map((e) => `${formatDate(e.date)}${e.provider ? ` ${e.provider}` : ""}: ${e.amount.toFixed(2)}`)
                  .join(" | ")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
