import Link from "next/link";
import { BILL_TYPE_LABELS, BILL_TYPES } from "@/lib/billTypes";
import { uploadBill } from "./actions";

export default async function NewBillPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main>
      <Link href="/bills" className="back">
        &larr; Your bills
      </Link>
      <div className="page-head">
        <div>
          <h1>Upload a bill</h1>
          <p className="lede">
            Take a photo or choose a PDF. BillShield reads the type, company, date and lines. You check and correct them
            before anything is saved.
          </p>
        </div>
      </div>

      {error && <p role="alert">{error}</p>}

      <section>
        <form action={uploadBill} className="form-grid">
          <label>
            Bill type (optional)
            <select name="bill_type" defaultValue="auto">
              <option value="auto">Let BillShield choose</option>
              {BILL_TYPES.map((type) => (
                <option key={type} value={type}>
                  {BILL_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Company or shop (optional)
            <input name="provider" type="text" placeholder="Read from the bill if you leave it empty" />
          </label>
          <label className="full">
            Photo or PDF (JPG, PNG, WebP or PDF, up to 4 MB)
            <input
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              required
            />
          </label>
          <div className="full">
            <button type="submit">Upload the bill</button>
          </div>
        </form>
      </section>
    </main>
  );
}
