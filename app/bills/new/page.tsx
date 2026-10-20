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
      <p>
        <Link href="/bills">Back to bills</Link>
      </p>
      <h1>Upload a bill</h1>
      {error && <p role="alert">{error}</p>}
      <form action={uploadBill}>
        <p>
          <label>
            Bill type{" "}
            <select name="bill_type" required>
              <option value="lpg">LPG</option>
              <option value="electricity">Electricity</option>
              <option value="broadband">Broadband</option>
              <option value="phone">Phone</option>
              <option value="other">Other</option>
            </select>
          </label>
        </p>
        <p>
          <label>
            Provider (optional) <input name="provider" type="text" />
          </label>
        </p>
        <p>
          <label>
            Period start (optional) <input name="period_start" type="date" />
          </label>
        </p>
        <p>
          <label>
            Period end (optional) <input name="period_end" type="date" />
          </label>
        </p>
        <p>
          <label>
            Photo <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required />
          </label>
        </p>
        <button type="submit">Upload</button>
      </form>
    </main>
  );
}
