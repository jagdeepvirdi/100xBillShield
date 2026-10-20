import BillInfoFields, { type InfoDefaults } from "../BillInfoFields";
import { updateBill } from "./actions";

export default function EditBill({ billId, defaults, error }: { billId: string; defaults: InfoDefaults; error?: string }) {
  return (
    <details className="edit-bill" open={Boolean(error)}>
      <summary>Edit bill details</summary>
      <p className="muted">Correct the type, company or date if BillShield read them wrong.</p>
      {error && <p role="alert">{error}</p>}
      <form action={updateBill} className="form-grid">
        <input type="hidden" name="bill_id" value={billId} />
        <BillInfoFields defaults={defaults} />
        <div className="full">
          <button type="submit">Save details</button>
        </div>
      </form>
    </details>
  );
}
