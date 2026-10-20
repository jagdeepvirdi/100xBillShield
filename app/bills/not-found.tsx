import Link from "next/link";

// Shown for a bill that does not exist or belongs to someone else (RLS returns no row for both).
export default function BillNotFound() {
  return (
    <main>
      <section className="empty">
        <h1>Bill not found</h1>
        <p>It may have been removed, or it may belong to a different account.</p>
        <Link href="/bills" className="btn">
          Back to your bills
        </Link>
      </section>
    </main>
  );
}
