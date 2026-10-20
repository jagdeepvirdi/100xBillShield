import type { BillStatus } from "@/lib/billStatus";

type Info = { label: string; tone: "good" | "bad" | "warn" | "neutral"; text: string };

// text is the sentence shown in the banner at the top of a bill; unread and unchecked get a "next step" instead.
export const STATUS: Record<BillStatus, Info> = {
  unread: { label: "Lines not read yet", tone: "neutral", text: "" },
  unchecked: { label: "Not checked yet", tone: "neutral", text: "" },
  needs_answer: {
    label: "Needs your answer",
    tone: "warn",
    text: "Some charges are new or changed since your last bill. Answer the questions below so BillShield knows whether to dispute them.",
  },
  unconfirmed: {
    label: "Could not fully verify",
    tone: "warn",
    text: "A total could not be confirmed from the lines that were read. Compare the lines with your paper bill and correct any that are wrong.",
  },
  verified: {
    label: "Verified, no errors found",
    tone: "good",
    text: "Every line checks out. The maths is shown below, and there is no message to send.",
  },
  error: {
    label: "Error found",
    tone: "bad",
    text: "BillShield found a line that does not add up, or one you do not accept. The checks below show the maths.",
  },
  sent: {
    label: "Dispute sent",
    tone: "bad",
    text: "You sent your message to the company. If they send a corrected bill, upload it or run the checks again.",
  },
};

const CLASS = { good: "verdict verdict-ok", bad: "verdict verdict-wrong", warn: "verdict verdict-unexplained", neutral: "pill" };

export default function StatusBadge({ status }: { status: BillStatus }) {
  const { label, tone } = STATUS[status];
  return <span className={CLASS[tone]}>{label}</span>;
}
