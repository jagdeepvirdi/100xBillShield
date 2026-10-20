import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadStatuses } from "./loadStatuses";
import StatusBadge from "./StatusBadge";
import { billTypeLabel, formatStamp, periodText } from "./format";

export default async function BillsPage() {
  const supabase = await createClient();

  // No user filter on purpose: RLS returns only this user's bills.
  const { data: bills, error } = await supabase
    .from("bill")
    .select("id, provider, bill_type, period_start, period_end, created_at")
    .order("created_at", { ascending: false });
  const statuses = await loadStatuses(supabase);

  return (
    <main>
      <div className="page-head">
        <div>
          <h1>Your bills</h1>
          <p className="lede">Open a bill to check its lines, or upload a new one.</p>
        </div>
        <Link href="/bills/new" className="btn">
          Upload a bill
        </Link>
      </div>

      <div className="callout">
        <h2>Upload your bill, verify the charges, and challenge the unexpected fees.</h2>
        <p>
          BillShield reads the bill, checks every amount with code, and writes a short message you can send if a charge
          is wrong or unexplained. If everything adds up, it says so and shows the maths.
        </p>
      </div>

      {error && <p role="alert">Could not load your bills: {error.message}</p>}

      {bills?.length === 0 && (
        <section className="empty">
          <h2>No bills yet</h2>
          <p>
            Upload a photo or PDF of a bill. BillShield reads the lines, checks them against what you were promised,
            and writes a message if something is wrong.
          </p>
          <Link href="/bills/new" className="btn">
            Upload your first bill
          </Link>
        </section>
      )}

      {bills && bills.length > 0 && (
        <ul className="bill-list">
          {bills.map((bill) => (
            <li key={bill.id}>
              <Link href={`/bills/${bill.id}`} className="row-link">
                <div>
                  <div className="title">{bill.provider ?? "Unnamed bill"}</div>
                  <div className="muted">
                    {periodText(bill.period_start, bill.period_end)}. Added {formatStamp(bill.created_at)}.
                  </div>
                </div>
                <div className="row-side">
                  <StatusBadge status={statuses.get(bill.id) ?? "unread"} />
                  <span className="pill">{billTypeLabel(bill.bill_type)}</span>
                  <span className="chevron" aria-hidden="true">
                    &rsaquo;
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
