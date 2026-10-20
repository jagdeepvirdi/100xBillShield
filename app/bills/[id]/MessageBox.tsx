"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function MessageBox({ billId }: { billId: string }) {
  const router = useRouter();
  const [tone, setTone] = useState("polite");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function write() {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch("/api/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billId, tone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not write the message.");
      if (data.source === "template") {
        setNote("The AI wording did not pass the number check, so this is a plain message built by code.");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not write the message.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {error && <p role="alert">{error}</p>}
      {note && <p>{note}</p>}
      <label>
        Tone{" "}
        <select value={tone} onChange={(e) => setTone(e.target.value)}>
          <option value="polite">Polite</option>
          <option value="friendly">Friendly</option>
          <option value="firm">Firm</option>
        </select>
      </label>{" "}
      <button type="button" onClick={write} disabled={busy}>
        {busy ? "Writing..." : "Write the message"}
      </button>
    </div>
  );
}
