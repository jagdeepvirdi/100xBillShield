import Link from "next/link";
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
            Take a photo or choose a PDF. Next you will check the lines BillShield reads from it, so nothing is saved
            until you confirm them.
          </p>
        </div>
      </div>

      {error && <p role="alert">{error}</p>}

      <section>
        <form action={uploadBill} className="form-grid">
          <label>
            Bill type
            <select name="bill_type" required>
              <option value="lpg">LPG</option>
              <option value="electricity">Electricity</option>
              <option value="broadband">Broadband</option>
              <option value="phone">Phone</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label>
            Provider (optional)
            <input name="provider" type="text" placeholder="For example, the company name" />
          </label>
          <label>
            Period start (optional)
            <input name="period_start" type="date" />
          </label>
          <label>
            Period end (optional)
            <input name="period_end" type="date" />
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
