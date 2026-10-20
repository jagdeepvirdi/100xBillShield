"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { runDetailChecks, type DetailSection } from "@/lib/detailChecks";
import { confirmLines } from "./actions";
import { money, verdictClass } from "./checkFormat";

// ref is the line's position in what the reader found, so detail blocks still point at it after edits.
type Row = { label: string; amount: string; ref: number | null };
type Detail = DetailSection & { itemCount: number };

export default function LinesEditor({ billId }: { billId: string }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [details, setDetails] = useState<Detail[]>([]);
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
      setRows(
        data.lines.map((l: { label: string; amount: number }, i: number) => ({ label: l.label, amount: String(l.amount), ref: i })),
      );
      setDetails(
        data.details.map((d: { name: string; summaryIndex: number | null; items: { amount: number }[]; subtotal: number | null }) => ({
          name: d.name,
          summaryRef: d.summaryIndex,
          items: d.items.map((item) => item.amount),
          subtotal: d.subtotal,
          itemCount: d.items.length,
        })),
      );
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
    const lines = rows.map((r) => ({ label: r.label, amount: Number(r.amount), ref: r.ref }));
    if (rows.some((r) => !r.label.trim() || !r.amount.trim()) || lines.some((l) => !Number.isFinite(l.amount))) {
      setError("Every line needs a label and a number amount.");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await confirmLines(billId, lines, details);
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

  // Same code that runs on confirm, so what is shown here is what gets saved.
  const summary = new Map(
    rows.flatMap((r) => (r.ref !== null && r.amount.trim() && Number.isFinite(Number(r.amount)) ? [[r.ref, { amount: Number(r.amount) }] as const] : [])),
  );
  const detailResults = runDetailChecks(details, summary);

  return (
    <section>
      <h2>Check the lines</h2>
      <p>These are the Summary lines of the bill. Fix anything the reader got wrong, then confirm.</p>
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
      {details.length > 0 && (
        <>
          <h3>Detailed pages</h3>
          <p className="muted">
            {details.map((d) => `${d.name} (${d.itemCount} ${d.itemCount === 1 ? "item" : "items"})`).join(", ")}. These
            are not loaded as lines. They are only checked against the Summary above.
          </p>
          {detailResults.length > 0 && (
            <div className="table-wrap">
              <table className="wide">
                <thead>
                  <tr>
                    <th>Check</th>
                    <th className="num">Expected</th>
                    <th className="num">Actual</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {detailResults.map((r, i) => (
                    <tr key={i}>
                      <td>{r.rule.replace(/^Detail: /, "")}</td>
                      <td className="num">{money(r.expected)}</td>
                      <td className="num">{money(r.actual)}</td>
                      <td>
                        <span className={verdictClass(r.verdict)}>{r.verdict}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      <p>
        <button type="button" className="secondary" onClick={() => setRows([...rows, { label: "", amount: "", ref: null }])}>
          Add a line
        </button>{" "}
        <button type="button" onClick={confirm} disabled={busy || rows.length === 0}>
          {busy ? "Saving..." : "Confirm lines"}
        </button>
      </p>
    </section>
  );
}
