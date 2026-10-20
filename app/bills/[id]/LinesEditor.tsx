"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { confirmLines } from "./actions";

type Row = { label: string; amount: string };

export default function LinesEditor({ billId }: { billId: string }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function readBill() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not read the bill.");
      setRows(data.lines.map((l: { label: string; amount: number }) => ({ label: l.label, amount: String(l.amount) })));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read the bill.");
    } finally {
      setBusy(false);
    }
  }

  function update(index: number, patch: Partial<Row>) {
    setRows((current) => current!.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  async function confirm() {
    if (!rows) return;
    const lines = rows.map((r) => ({ label: r.label, amount: Number(r.amount) }));
    if (rows.some((r) => !r.label.trim() || !r.amount.trim()) || lines.some((l) => !Number.isFinite(l.amount))) {
      setError("Every line needs a label and a number amount.");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await confirmLines(billId, lines);
    setBusy(false);
    if (result.error) setError(result.error);
    else router.refresh();
  }

  if (!rows) {
    return (
      <section>
        <h2>Bill lines</h2>
        {error && <p role="alert">{error}</p>}
        <button type="button" onClick={readBill} disabled={busy}>
          {busy ? "Reading the bill..." : "Read the bill"}
        </button>
      </section>
    );
  }

  return (
    <section>
      <h2>Check the lines</h2>
      <p>Fix anything the reader got wrong, then confirm.</p>
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
              <tr key={index}>
                <td>
                  <input value={row.label} onChange={(e) => update(index, { label: e.target.value })} />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.01"
                    value={row.amount}
                    onChange={(e) => update(index, { amount: e.target.value })}
                  />
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
        <button type="button" className="secondary" onClick={() => setRows([...rows, { label: "", amount: "" }])}>
          Add a line
        </button>{" "}
        <button type="button" onClick={confirm} disabled={busy || rows.length === 0}>
          {busy ? "Saving..." : "Confirm lines"}
        </button>
      </p>
    </section>
  );
}
