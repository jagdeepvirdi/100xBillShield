import type { EarlierLine } from "@/lib/history";
import { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Lines of the user's earlier bills (RLS limits both queries to the caller's own rows).
export async function loadEarlierLines(supabase: Supabase, createdAt: string): Promise<EarlierLine[]> {
  const { data: bills } = await supabase
    .from("bill")
    .select("id, provider, created_at")
    .lt("created_at", createdAt)
    .order("created_at", { ascending: false })
    .limit(24);
  if (!bills?.length) return [];

  const { data: items } = await supabase
    .from("line_item")
    .select("bill_id, label, amount")
    .in(
      "bill_id",
      bills.map((b) => b.id),
    )
    .order("line_no");

  const billById = new Map(bills.map((b) => [b.id, b]));
  return (items ?? []).flatMap((item) => {
    const bill = billById.get(item.bill_id);
    return bill
      ? [{ billId: bill.id, date: bill.created_at, provider: bill.provider, label: item.label, amount: Number(item.amount) }]
      : [];
  });
}
