import Link from "next/link";
import { isOneOff } from "@/lib/billTypes";
import type { LineHistory } from "@/lib/history";
import { billTypeLabel, formatDay, formatStamp, periodText } from "../format";
import { runBillChecks, savePromise } from "./actions";
import type { CheckRow } from "./checkFormat";
import CheckResults from "./CheckResults";
import CleanBill from "./CleanBill";
import DeleteBill from "./DeleteBill";
import EditBill from "./EditBill";
import EarlierBills from "./EarlierBills";
import LinesEditor from "./LinesEditor";
import MessageBox from "./MessageBox";
import SentTracker from "./SentTracker";

type Money = number | string | null;

export type BillViewProps = {
  bill: { id: string; provider: string | null; bill_type: string; period_start: string | null; period_end: string | null; created_at: string };
  lines: { id: string; label: string; amount: Money }[];
  promise: { plan_price: Money; tax_included: boolean | null; discount: Money; effective_from: string | null; notes: string | null } | null;
  checks: CheckRow[];
  detailChecks: CheckRow[];
  histories: LineHistory[];
  message: { id: string; draft: string; sent_text: string | null; sent_at: string | null; words_changed: number | null } | null;
  promiseError?: string;
  checkError?: string;
  deleteError?: string;
  editError?: string;
};

function nextStep(s: { hasLines: boolean; hasPromise: boolean; hasChecks: boolean; allOk: boolean; hasIssues: boolean; message: BillViewProps["message"] }) {
  if (!s.hasLines) {
    return {
      title: "Next: read your bill",
      text: "Press Read the bill below, compare each line with your paper bill, fix anything that is wrong, then confirm the lines.",
    };
  }
  if (!s.hasChecks) {
    return s.hasPromise
      ? { title: "Next: run the checks", text: "Press Run the checks below to compare every amount with what it should be." }
      : {
          title: "Next: say what you were promised",
          text: "Fill in the promise form below (plan price, tax, discount), then run the checks. Without it BillShield can only check the maths.",
        };
  }
  if (s.allOk) {
    return { good: true, title: "Every line checks out", text: "There is nothing to dispute and no message to send. The maths is shown below." };
  }
  if (s.hasIssues && !s.message) {
    return { title: "Next: write your message", text: "BillShield found a line to question. Choose a tone and press Write the message." };
  }
  if (s.message && !s.message.sent_at) {
    return {
      title: "Next: send your message",
      text: "Copy it, send it to the company, then paste what you actually sent below so it is recorded.",
    };
  }
  if (s.message) {
    return { good: true, title: "Your message is recorded", text: "If you change the promise, run the checks again to see whether anything changed." };
  }
  return null;
}

export default function BillView({ bill, lines, promise, checks, detailChecks, histories, message, promiseError, checkError, deleteError, editError }: BillViewProps) {
  const labels = new Map(lines.map((line) => [line.id, line.label]));
  const shown = [...detailChecks, ...checks];
  const hasIssues = shown.some((row) => row.verdict !== "ok" && row.line_item_id);
  const allOk = checks.length > 0 && shown.every((row) => row.verdict === "ok");
  // A one-off purchase has no promised plan, so nothing is waited for there.
  const oneOff = isOneOff(bill.bill_type);
  const step = nextStep({ hasLines: lines.length > 0, hasPromise: oneOff || Boolean(promise), hasChecks: checks.length > 0, allOk, hasIssues, message });

  return (
    <main>
      <Link href="/bills" className="back">
        &larr; Your bills
      </Link>

      <div className="page-head">
        <div>
          <h1>{bill.provider ?? "Unnamed bill"}</h1>
          <div className="meta">
            <span className="pill">{billTypeLabel(bill.bill_type)}</span>
            <span>{periodText(bill.period_start, bill.period_end)}</span>
            <span>Added {formatStamp(bill.created_at)}</span>
          </div>
        </div>
      </div>

      <EditBill billId={bill.id} defaults={bill} error={editError} />

      {step && (
        <div className={`callout${step.good ? " good" : ""}`}>
          <h2>{step.title}</h2>
          <p>{step.text}</p>
        </div>
      )}

      {lines.length > 0 ? (
        <section>
          <h2>Bill lines</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Line</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id}>
                    <td>{line.label}</td>
                    <td className="num">{Number(line.amount).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <LinesEditor bill={bill} />
      )}

      {!oneOff && (
        <section>
          <h2>What you were promised</h2>
          {promise ? (
            <dl className="facts">
              <dt>Plan price</dt>
              <dd>{Number(promise.plan_price).toFixed(2)}</dd>
              <dt>Tax included</dt>
              <dd>{promise.tax_included ? "Yes" : "No"}</dd>
              <dt>Discount</dt>
              <dd>{promise.discount === null ? "None" : `${Number(promise.discount)}%`}</dd>
              <dt>Effective from</dt>
              <dd>{promise.effective_from ? formatDay(promise.effective_from) : "Not given"}</dd>
              {promise.notes && (
                <>
                  <dt>Notes</dt>
                  <dd>{promise.notes}</dd>
                </>
              )}
            </dl>
          ) : (
            <p className="muted">The checks compare your bill with this. Enter what the company told you.</p>
          )}
          <h3>{promise ? "Save a new promise" : "Save the promise"}</h3>
          {promise && <p className="muted">Saving again keeps the old one. The newest promise is the one used.</p>}
          {promiseError && <p role="alert">{promiseError}</p>}
          <form action={savePromise} className="form-grid">
            <input type="hidden" name="bill_id" value={bill.id} />
            <label>
              Plan price
              <input name="plan_price" type="number" step="0.01" min="0" required />
            </label>
            <label>
              Is tax included in that price?
              <select name="tax_included" required>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>
            <label>
              Discount % (optional)
              <input name="discount" type="number" step="0.01" min="0" max="100" />
            </label>
            <label>
              Effective from (optional)
              <input name="effective_from" type="date" />
            </label>
            <label className="full">
              Notes (optional, no account numbers, phone numbers or addresses)
              <textarea name="notes" rows={3} maxLength={1000} />
            </label>
            <div className="full">
              <button type="submit">Save promise</button>
            </div>
          </form>
        </section>
      )}

      {lines.length > 0 && (
        <section>
          <h2>Checks</h2>
          {checkError && <p role="alert">{checkError}</p>}
          {allOk && <CleanBill rows={shown} labels={labels} />}
          {shown.length > 0 && !allOk && <CheckResults rows={shown} labels={labels} />}
          <form action={runBillChecks}>
            <input type="hidden" name="bill_id" value={bill.id} />
            <button type="submit" className={checks.length > 0 ? "secondary" : undefined}>
              {checks.length > 0 ? "Run the checks again" : "Run the checks"}
            </button>
          </form>
          {!oneOff && <p className="muted">Run them again after you save or change the promise.</p>}
        </section>
      )}

      {hasIssues && (
        <section>
          <h2>Message to the company</h2>
          <MessageBox billId={bill.id} />
          {message && (
            <SentTracker
              key={message.id}
              messageId={message.id}
              draft={message.draft}
              sentText={message.sent_text}
              sentOn={message.sent_at ? formatStamp(message.sent_at) : null}
              wordsChanged={message.words_changed}
            />
          )}
        </section>
      )}

      {histories.length > 0 && <EarlierBills histories={histories} />}

      <DeleteBill billId={bill.id} error={deleteError} />
    </main>
  );
}
