import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
    </main>
  );
}
