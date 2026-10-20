import Link from "next/link";
import type { BillStatus } from "@/lib/billStatus";
import { isOneOff } from "@/lib/billTypes";
import { sumBreakdown } from "@/lib/checks";
import type { LineHistory } from "@/lib/history";
import { STATUS } from "../StatusBadge";
import { billTypeLabel, formatStamp, periodText } from "../format";
import { runBillChecks } from "./actions";
import type { CheckRow } from "./checkFormat";
import AnswerBox, { type Answered, type Question } from "./AnswerBox";
import CheckResults from "./CheckResults";
import CleanBill from "./CleanBill";
import DeleteBill from "./DeleteBill";
import EditBill from "./EditBill";
import EditLines from "./EditLines";
import EarlierBills from "./EarlierBills";
import LinesEditor from "./LinesEditor";
import MessageBox from "./MessageBox";
import PromiseSection, { type PromiseRow } from "./PromiseSection";
import SentTracker from "./SentTracker";

type Money = number | string | null;

export type BillViewProps = {
  bill: { id: string; provider: string | null; bill_type: string; period_start: string | null; period_end: string | null; created_at: string };
  lines: { id: string; label: string; amount: Money; units: Money; rate: Money }[];
  promise: PromiseRow | null;
  checks: CheckRow[];
  detailChecks: CheckRow[];
  status: BillStatus;
  sentAt: string | null;
  questions: Question[];
  answered: Answered[];
  histories: LineHistory[];
  message: { id: string; draft: string; sent_text: string | null; sent_at: string | null; words_changed: number | null } | null;
  promiseError?: string;
  checkError?: string;
  deleteError?: string;
  editError?: string;
};

function nextStep(s: { hasLines: boolean; hasPromise: boolean; hasChecks: boolean; hasIssues: boolean; message: BillViewProps["message"] }) {
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
  if (s.hasIssues && !s.message) {
    return { title: "Next: write your message", text: "BillShield found a line to question. Choose a tone and press Write the message." };
  }
  if (s.message && !s.message.sent_at) {
    return {
      title: "Next: send your message",
      text: "Copy it, send it to the company, then paste what you actually sent below so it is recorded.",
    };
  }
  return null;
}

export default function BillView({ bill, lines, promise, checks, detailChecks, status, sentAt, questions, answered, histories, message, promiseError, checkError, deleteError, editError }: BillViewProps) {
  const labels = new Map(lines.map((line) => [line.id, line.label]));
  // Lines still waiting for an answer are asked about above the checks, not listed in them.
  const shown = [...detailChecks, ...checks].filter((row) => row.state !== "pending");
  const hasIssues = shown.some((row) => (row.state === "wrong" || row.state === "disputed") && row.line_item_id);
  const allOk = status === "verified";
  const banner = STATUS[status];
  const sentOn = sentAt ? formatStamp(sentAt) : null;
  // A one-off purchase has no promised plan, so nothing is waited for there.
  const oneOff = isOneOff(bill.bill_type);
  // Where a "not confirmed" sum comes from, so the lines involved can be found and highlighted.
  const unconfirmed = shown.some((row) => row.state === "unconfirmed");
  const breakdown = unconfirmed
    ? sumBreakdown(lines.map((line) => ({ id: line.id, label: line.label, amount: Number(line.amount) })))
    : null;
  const suspects = new Set(breakdown?.suspectIds ?? []);
  // Lines a failed check points at, so the lines table can mark them (a wrong check beats a disputed one).
  const flagged = new Map<string, "wrong" | "disputed">();
  for (const row of shown) {
    if (!row.line_item_id || (row.state !== "wrong" && row.state !== "disputed")) continue;
    if (row.state === "wrong" || !flagged.has(row.line_item_id)) flagged.set(row.line_item_id, row.state);
  }
  const hasRates = lines.some((line) => line.units !== null || line.rate !== null);
  const step = nextStep({ hasLines: lines.length > 0, hasPromise: oneOff || Boolean(promise), hasChecks: checks.length > 0, hasIssues, message });

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

      {banner.text && (
        <div className={`callout ${banner.tone}`}>
          <h2>{banner.label}</h2>
          <p>
            {banner.text}
            {status === "sent" && sentOn ? ` You sent it on ${sentOn}.` : ""}
            {status === "verified" && sentOn ? ` You sent a message about this bill on ${sentOn}.` : ""}
          </p>
          {status === "verified" && (
            <p>
              <Link href="/bills" className="btn">
                All well, back to my bills
              </Link>
            </p>
          )}
        </div>
      )}

      {step && (
        <div className="callout">
          <h2>{step.title}</h2>
          <p>{step.text}</p>
        </div>
      )}

      {(questions.length > 0 || answered.length > 0) && <AnswerBox billId={bill.id} questions={questions} answered={answered} />}

      {lines.length > 0 ? (
        <section id="bill-lines">
          <h2>Bill lines</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Line</th>
                  {hasRates && <th className="num">Units</th>}
                  {hasRates && <th className="num">Rate</th>}
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id} id={`line-${line.id}`} className={flagged.has(line.id) ? "flagged" : suspects.has(line.id) ? "suspect" : undefined}>
                    <td>
                      {line.label}
                      {flagged.get(line.id) === "wrong" && <span className="verdict verdict-wrong"> wrong, see the check</span>}
                      {flagged.get(line.id) === "disputed" && <span className="verdict verdict-unexplained"> disputed</span>}
                      {!flagged.has(line.id) && suspects.has(line.id) && <span className="verdict verdict-unexplained"> check this line</span>}
                    </td>
                    {hasRates && <td className="num">{line.units === null ? "" : Number(line.units)}</td>}
                    {hasRates && <td className="num">{line.rate === null ? "" : Number(line.rate)}</td>}
                    <td className="num">{Number(line.amount).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <EditLines key={lines.map((l) => `${l.id}:${l.amount}:${l.label}:${l.units}:${l.rate}`).join()} billId={bill.id} lines={lines} />
        </section>
      ) : (
        <LinesEditor bill={bill} />
      )}

      <PromiseSection billId={bill.id} billType={bill.bill_type} promise={promise} error={promiseError} />

      {lines.length > 0 && (
        <section>
          <h2>Checks</h2>
          {checkError && <p role="alert">{checkError}</p>}
          {allOk && <CleanBill rows={shown} labels={labels} />}
          {allOk && (
            <p>
              <Link href="/bills" className="btn">
                All well, back to my bills
              </Link>
            </p>
          )}
          {shown.length > 0 && !allOk && <CheckResults rows={shown} labels={labels} />}
          {breakdown && (
            <div className="callout warn">
              <h2>Why a total is not confirmed</h2>
              <p>
                The lines counted add up to {breakdown.expected.toFixed(2)}, but the printed total ({breakdown.target.label}) is{" "}
                {breakdown.target.amount.toFixed(2)}, a gap of {breakdown.gap.toFixed(2)}.
                {suspects.size > 0
                  ? ` The highlighted ${suspects.size === 1 ? "line has" : "lines have"} that amount: it may be a total printed again, or a line read twice.`
                  : ""}{" "}
                Compare the lines with your paper bill and fix them under Edit lines.
              </p>
            </div>
          )}
          <form action={runBillChecks}>
            <input type="hidden" name="bill_id" value={bill.id} />
            <button type="submit" className={checks.length > 0 ? "secondary" : undefined}>
              {checks.length > 0 ? "Run the checks again" : "Run the checks"}
            </button>
          </form>
          <p className="muted">Saving a promise or quote runs the checks again for you.</p>
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
