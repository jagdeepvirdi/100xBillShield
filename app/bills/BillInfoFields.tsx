import { BILL_TYPE_LABELS, BILL_TYPES } from "@/lib/billTypes";

export type InfoDefaults = {
  bill_type: string;
  provider: string | null;
  period_start: string | null;
  period_end: string | null;
};

// Type, provider and date fields, used when confirming the lines and in the edit form.
export default function BillInfoFields({ defaults }: { defaults: InfoDefaults }) {
  return (
    <>
      <label>
        Bill type
        <select name="bill_type" defaultValue={defaults.bill_type}>
          {BILL_TYPES.map((type) => (
            <option key={type} value={type}>
              {BILL_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </label>
      <label>
        Company or shop
        <input name="provider" type="text" defaultValue={defaults.provider ?? ""} placeholder="Name on the bill" maxLength={120} />
      </label>
      <label>
        Bill date or period start
        <input name="period_start" type="date" defaultValue={defaults.period_start ?? ""} />
      </label>
      <label>
        Period end (leave empty for a one-day bill)
        <input name="period_end" type="date" defaultValue={defaults.period_end ?? ""} />
      </label>
    </>
  );
}
