import Link from "next/link";
import { logout } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";

export default async function BillsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // No user filter on purpose: RLS returns only this user's bills.
  const { data: bills, error } = await supabase
    .from("bill")
    .select("id, provider, bill_type, period_start, period_end, created_at")
    .order("created_at", { ascending: false });

  return (
    <main>
      <h1>Your bills</h1>
      <p>Signed in as {user?.email}</p>
      <form action={logout}>
        <button type="submit">Log out</button>
      </form>

      {error && <p role="alert">Could not load bills: {error.message}</p>}
      {bills?.length === 0 && <p>No bills yet.</p>}
      <ul>
        {bills?.map((bill) => (
          <li key={bill.id}>
            <Link href={`/bills/${bill.id}`}>
              {bill.provider ?? "Unknown provider"} - {bill.bill_type}
            </Link>{" "}
            ({bill.period_start ?? "?"} to {bill.period_end ?? "?"})
          </li>
        ))}
      </ul>
    </main>
  );
}
