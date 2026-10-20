import { promiseKind } from "@/lib/billTypes";
import { formatDay } from "../format";
import { savePromise } from "./actions";

type Money = number | string | null;

export type PromiseRow = {
  plan_price: Money;
  tax_included: boolean | null;
  discount: Money;
  unit_rate: Money;
  fixed_charge: Money;
  effective_from: string | null;
  notes: string | null;
};

const TITLE = { fixed: "What you were promised", rate: "Your tariff", quote: "What you were quoted (optional)" };
const EMPTY = {
  fixed: "The checks compare your bill with this. Enter what the company told you.",
  rate: "Enter the rate per unit and the fixed charge from your tariff. The rate printed on the bill is then compared with it.",
  quote: "If you were given a price before buying (a booking confirmation, a menu total or an estimate), enter it and the bill total is compared with it.",
};

// "Promised" means a different thing for each kind of bill: a fixed price, a tariff per unit, or a quoted total.
export default function PromiseSection({ billId, billType, promise, error }: { billId: string; billType: string; promise: PromiseRow | null; error?: string }) {
  const kind = promiseKind(billType);

  return (
    <section>
      <h2>{TITLE[kind]}</h2>
      {promise ? (
        <dl className="facts">
          {promise.plan_price !== null && (
            <>
              <dt>{kind === "quote" ? "Quoted total" : "Plan price"}</dt>
              <dd>{Number(promise.plan_price).toFixed(2)}</dd>
            </>
          )}
          {promise.unit_rate !== null && (
            <>
              <dt>Rate per unit</dt>
              <dd>{Number(promise.unit_rate)}</dd>
            </>
          )}
          {promise.fixed_charge !== null && (
            <>
              <dt>Fixed charge</dt>
              <dd>{Number(promise.fixed_charge).toFixed(2)}</dd>
            </>
          )}
          {kind === "fixed" && (
            <>
              <dt>Tax included</dt>
              <dd>{promise.tax_included ? "Yes" : "No"}</dd>
            </>
          )}
          {kind !== "quote" && (
            <>
              <dt>Discount</dt>
              <dd>{promise.discount === null ? "None" : `${Number(promise.discount)}%`}</dd>
              <dt>Effective from</dt>
              <dd>{promise.effective_from ? formatDay(promise.effective_from) : "Not given"}</dd>
            </>
          )}
          {promise.notes && (
            <>
              <dt>Notes</dt>
              <dd>{promise.notes}</dd>
            </>
          )}
        </dl>
      ) : (
        <p className="muted">{EMPTY[kind]}</p>
      )}
      <h3>{promise ? "Save a new one" : "Save it"}</h3>
      {promise && <p className="muted">Saving again keeps the old one. The newest one is the one used.</p>}
      {error && <p role="alert">{error}</p>}
      <form action={savePromise} className="form-grid">
        <input type="hidden" name="bill_id" value={billId} />
        {kind === "fixed" && (
          <>
            <label>
              Plan price
              <input name="plan_price" type="number" step="0.01" min="0" required />
            </label>
            <label>
              Is tax included in that price?
              <select name="tax_included" required>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>
          </>
        )}
        {kind === "rate" && (
          <>
            <label>
              Rate per unit
              <input name="unit_rate" type="number" step="any" min="0" />
            </label>
            <label>
              Fixed charge (optional)
              <input name="fixed_charge" type="number" step="0.01" min="0" />
            </label>
          </>
        )}
        {kind === "quote" && (
          <label>
            Total you were quoted
            <input name="plan_price" type="number" step="0.01" min="0" required />
          </label>
        )}
        {kind !== "quote" && (
          <>
            <label>
              Discount % (optional)
              <input name="discount" type="number" step="0.01" min="0" max="100" />
            </label>
            <label>
              Effective from (optional)
              <input name="effective_from" type="date" />
            </label>
          </>
        )}
        <label className="full">
          Notes (optional, no account numbers, phone numbers or addresses)
          <textarea name="notes" rows={3} maxLength={1000} />
        </label>
        <div className="full">
          <button type="submit">Save</button>
        </div>
      </form>
    </section>
  );
}
