// Best-effort removal of account numbers, phone numbers and addresses from a bill label.
// The extraction prompt also tells the model to leave them out; this is the code-side net.

const PLACEHOLDER = "Unnamed line (please edit)";

const ADDRESS_WORDS = /\b(road|rd|street|st|lane|nagar|colony|sector|flat|floor|apartment|pin\s*code|pincode)\b/i;
const LABELLED_ID =
  /\b(?:a\/c|acct?|account|consumer|customer|mobile|phone|contact)\s*(?:no|number|id|#)\.?\s*[:#-]?\s*[\w-]+/gi;
const PHONE = /\+?\d[\d\s().-]{8,}\d/g;
const LONG_DIGITS = /\d{6,}/g;

// Free text (promise notes): strips ids and phone numbers, keeps the rest.
export function redactText(text: string): string {
  return text
    .replace(LABELLED_ID, " ")
    .replace(PHONE, " ")
    .replace(LONG_DIGITS, " ")
    .replace(/[^\S\n]+/g, " ")
    .trim();
}

export function redactLabel(label: string): string {
  if (ADDRESS_WORDS.test(label)) return PLACEHOLDER;

  const cleaned = redactText(label).replace(/^[\s:,;#-]+|[\s:,;#-]+$/g, "");
  return cleaned || PLACEHOLDER;
}
