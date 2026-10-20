"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveLines } from "./actions";

type Row = { id: string | null; label: string; amount: string };

// Corrects lines after they were confirmed: fix a label or amount, remove a line that should not be there
// (for example a total read as a charge), or add one that was missed. The checks then run again.
export default function EditLines({ billId, lines }: { billId: string; lines: { id: string; label: string; amount: number | string | null }[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(lines.map((l) => ({ id: l.id, label: l.label, amount: String(Number(l.amount)) })));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(index: number, patch: Partial<Row>) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  async function save() {
    const parsed = rows.map((r) => ({ id: r.id, label: r.label, amount: Number(r.amount) }));
    if (rows.some((r) => !r.label.trim() || !r.amount.trim()) || parsed.some((l) => !Number.isFinite(l.amount))) {
      setError("Every line needs a label and a number amount.");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await saveLines(billId, parsed);
    setBusy(false);
    if (result.error) setError(result.error);
    else router.refresh();
  }

  return (
    <details className="edit-bill">
      <summary>Edit lines</summary>
      <p className="muted">
        Fix a label or amount, remove a line that should not be there (such as a total read as a charge), or add one
        that was missed. The checks run again when you save, and earlier results are kept.
      </p>
      {error && <p role="alert">{error}</p>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Label</th>
              <th className="num">Amount</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id ?? `new-${index}`}>
                <td>
                  <input value={row.label} onChange={(e) => update(index, { label: e.target.value })} />
                </td>
                <td>
                  <input type="number" step="0.01" value={row.amount} onChange={(e) => update(index, { amount: e.target.value })} />
                </td>
                <td>
                  <button type="button" className="secondary small" onClick={() => setRows(rows.filter((_, i) => i !== index))}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        <button type="button" className="secondary" onClick={() => setRows([...rows, { id: null, label: "", amount: "" }])}>
          Add a line
        </button>{" "}
        <button type="button" onClick={save} disabled={busy || rows.length === 0}>
          {busy ? "Saving..." : "Save lines"}
        </button>
      </p>
    </details>
  );
}
