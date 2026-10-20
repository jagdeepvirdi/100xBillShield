"use client";

import { deleteBill } from "./actions";

export default function DeleteBill({ billId, error }: { billId: string; error?: string }) {
  return (
    <section>
      <h2>Delete this bill</h2>
      <p className="muted">Removes the bill, its lines, promises, checks, messages and the uploaded photo. This cannot be undone.</p>
      {error && <p role="alert">{error}</p>}
      <form
        action={deleteBill}
        onSubmit={(event) => {
          if (!window.confirm("Delete this bill and everything saved for it?")) event.preventDefault();
        }}
      >
        <input type="hidden" name="bill_id" value={billId} />
        <button type="submit" className="secondary">
          Delete bill
        </button>
      </form>
    </section>
  );
}
