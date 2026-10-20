"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveSent } from "./actions";

type Props = {
  messageId: string;
  draft: string;
  sentText: string | null;
  sentOn: string | null;
  wordsChanged: number | null;
};

export default function SentTracker({ messageId, draft, sentText, sentOn, wordsChanged }: Props) {
  const router = useRouter();
  const [text, setText] = useState(sentText ?? draft);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function copy() {
    setError(null);
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
    } catch {
      setError("Could not copy. Select the message and copy it by hand.");
    }
  }

  async function save() {
    setBusy(true);
    setError(null);
    const result = await saveSent(messageId, text);
    setBusy(false);
    if (result.error) setError(result.error);
    else router.refresh();
  }

  return (
    <div className="stack">
      <pre style={{ whiteSpace: "pre-wrap" }}>{draft}</pre>
      <p>
        <button type="button" className="secondary" onClick={copy}>
          Copy message
        </button>{" "}
        {copied && <span>Copied.</span>}
      </p>

      <h3>What you actually sent</h3>
      <p>Paste or edit the text you sent to the company, then save.</p>
      {error && <p role="alert">{error}</p>}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        maxLength={5000}
        style={{ width: "100%" }}
      />
      <p>
        <button type="button" onClick={save} disabled={busy || !text.trim()}>
          {busy ? "Saving..." : sentOn ? "Update what I sent" : "Save what I sent"}
        </button>
      </p>
      {sentOn && (
        <p>
          Sent on {sentOn}. Words changed from the draft: {wordsChanged}.
        </p>
      )}
    </div>
  );
}
