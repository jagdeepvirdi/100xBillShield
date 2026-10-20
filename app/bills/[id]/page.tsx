import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { runBillChecks, savePromise } from "./actions";
import CheckResults from "./CheckResults";
import LinesEditor from "./LinesEditor";

export default async function BillPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ promise_error?: string; check_error?: string }>;
}) {
  const { id } = await params;
  const { promise_error, check_error } = await searchParams;
  const supabase = await createClient();

  // RLS hides other users' bills, so a foreign or bad id gives no row.
  const { data: bill } = await supabase
    .from("bill")
    .select("id, provider, bill_type, period_start, period_end, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!bill) notFound();

  const { data: lines } = await supabase
    .from("line_item")
    .select("id, label, amount")
    .eq("bill_id", id)
    .order("line_no");

  // Promises are never overwritten; the newest one is the one in force.
  const { data: promise } = await supabase
    .from("promise")
    .select("plan_price, tax_included, discount, effective_from, notes")
    .eq("bill_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Every run is kept; the rows of one run share a created_at, so the newest run is the first group.
  const { data: checkRows } = await supabase
    .from("check_result")
    .select("id, rule, expected, actual, verdict, line_item_id, created_at")
    .eq("bill_id", id)
    .order("created_at", { ascending: false })
    .limit(200);
  const latestChecks = checkRows?.filter((row) => row.created_at === checkRows[0].created_at) ?? [];
  const lineLabels = new Map((lines ?? []).map((line) => [line.id, line.label]));

  return (
    <main>
      <p>
        <Link href="/bills">Back to bills</Link>
      </p>
      <h1>{bill.provider ?? "Unknown provider"}</h1>
      <p>Type: {bill.bill_type}</p>
      <p>
        Period: {bill.period_start ?? "?"} to {bill.period_end ?? "?"}
      </p>
      <p>Added: {new Date(bill.created_at).toLocaleDateString("en-GB")}</p>
      {lines && lines.length > 0 ? (
        <section>
          <h2>Bill lines</h2>
          <table>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id}>
                  <td>{line.label}</td>
                  <td>{line.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : (
        <LinesEditor billId={bill.id} />
      )}

      {lines && lines.length > 0 && (
        <section>
          <h2>Checks</h2>
          {check_error && <p role="alert">{check_error}</p>}
          {latestChecks.length > 0 && <CheckResults rows={latestChecks} labels={lineLabels} />}
          <form action={runBillChecks}>
            <input type="hidden" name="bill_id" value={bill.id} />
            <button type="submit">{latestChecks.length > 0 ? "Run the checks again" : "Run the checks"}</button>
          </form>
          <p>Run them again after you save or change the promise.</p>
        </section>
      )}

      <section>
        <h2>What you were promised</h2>
        {promise && (
          <ul>
            <li>Plan price: {promise.plan_price}</li>
            <li>Tax included: {promise.tax_included ? "yes" : "no"}</li>
            <li>Discount: {promise.discount === null ? "none" : `${promise.discount}%`}</li>
            <li>Effective from: {promise.effective_from ?? "not given"}</li>
            {promise.notes && <li>Notes: {promise.notes}</li>}
          </ul>
        )}
        <h3>{promise ? "Save a new promise" : "Save the promise"}</h3>
        {promise_error && <p role="alert">{promise_error}</p>}
        <form action={savePromise}>
          <input type="hidden" name="bill_id" value={bill.id} />
          <p>
            <label>
              Plan price <input name="plan_price" type="number" step="0.01" min="0" required />
            </label>
          </p>
          <p>
            <label>
              Tax included in that price?{" "}
              <select name="tax_included" required>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>
          </p>
          <p>
            <label>
              Discount % (optional) <input name="discount" type="number" step="0.01" min="0" max="100" />
            </label>
          </p>
          <p>
            <label>
              Effective from (optional) <input name="effective_from" type="date" />
            </label>
          </p>
          <p>
            <label>
              Notes (optional, no account numbers, phone numbers or addresses)
              <br />
              <textarea name="notes" rows={3} maxLength={1000} />
            </label>
          </p>
          <button type="submit">Save promise</button>
        </form>
      </section>
    </main>
  );
}
