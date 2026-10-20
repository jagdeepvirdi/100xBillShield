import { BILL_TYPE_LABELS } from "@/lib/billTypes";

export const billTypeLabel = (type: string) => BILL_TYPE_LABELS[type as keyof typeof BILL_TYPE_LABELS] ?? type;

// Date-only values (period start and end) are read as UTC so they never shift a day.
export const formatDay = (date: string) =>
  new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export const formatStamp = (timestamp: string) =>
  new Date(timestamp).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export function periodText(start: string | null, end: string | null) {
  if (start && start === end) return formatDay(start);
  if (start && end) return `${formatDay(start)} to ${formatDay(end)}`;
  if (start) return `From ${formatDay(start)}`;
  if (end) return `Until ${formatDay(end)}`;
  return "Date not given";
}
