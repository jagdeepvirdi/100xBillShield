import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LinesEditor from "./LinesEditor";

export default async function BillPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
    </main>
  );
}
