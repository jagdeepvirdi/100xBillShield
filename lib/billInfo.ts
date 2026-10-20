import { z } from "zod";
import { BILL_TYPES } from "./billTypes";
import { redactText } from "./redact";

const optionalDate = z.union([z.literal("").transform(() => null), z.iso.date()]);

// What the user can see and correct about a bill: type, who issued it, and the date or period.
// Used when the lines are confirmed and by the edit form, so both accept exactly the same input.
export const billInfoSchema = z
  .object({
    bill_type: z.enum(BILL_TYPES),
    provider: z.string().trim().max(120).transform((v) => redactText(v) || null),
    period_start: optionalDate,
    period_end: optionalDate,
  })
  .refine((v) => !(v.period_start && v.period_end && v.period_end < v.period_start), "Period end is before period start.");

export type BillInfo = z.infer<typeof billInfoSchema>;
