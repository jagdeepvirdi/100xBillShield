# BillShield: instructions for Claude Code

Put this file in the repo root. Read it fully before doing anything. Work ONE step at a time: finish a step, run it, tell me what changed and how I can verify it, then stop and wait for "next".

## What this app does
A user uploads a bill (photo), says what they were promised, and the app finds the line that does not add up and writes one message they can send to the company. If every line checks out, it says so and shows the maths. Winning condition: the user actually sends the message.

## Stack
Next.js (App Router, TypeScript) on Vercel. Supabase for auth, Postgres and storage. An LLM with vision, called only from server routes.

## Hard rules (never break these)
1. Every number shown to the user or written in a message is computed by code. The LLM never adds, subtracts or computes tax.
2. The LLM does only two things: (a) read a bill photo into JSON lines, (b) write the wording of a message from check results.
3. After a message is written, code verifies that every amount in it exists in the check results. If not: regenerate once, then fall back to a plain template message built by code.
4. The LLM key is used only in server code. No NEXT_PUBLIC_ prefix on it. Never commit secrets.
5. Schema and RLS are in `billshield-schema.sql`. Do not rename tables or columns, and do not weaken the RLS policies. If a change is needed, propose it and wait.
6. Never store account numbers, phone numbers or addresses. Strip them from extracted text before any insert.
7. Photos are uploaded to bucket `bill-images` under the path `<user id>/<uuid>.<ext>`.
8. Do not invent an error. "Every line checks out" is a valid result.
9. Ask before adding any dependency beyond: @supabase/supabase-js, @supabase/ssr, the LLM SDK, zod, vitest.

## Tables (already created in Supabase)
bill, promise, line_item, check_result, message. Auth users live in Supabase `auth.users`. Proof link: `message.line_item_id` points at the line item it disputes. Every table has `user_id` (RLS).

## Environment variables
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
ANTHROPIC_API_KEY=
```
Create `.env.example` with these names and no values.

## Steps

### Step 1: Supabase clients and session
- Browser client, server client and middleware to refresh the session using @supabase/ssr.
- Done when: the app runs locally with `npm run dev` and `npm run build` passes.

### Step 2: Login and signup
- `/login` and `/signup` (email + password), logout button, redirect logged-in users to `/bills`, redirect logged-out users away from `/bills`.
- Done when: I can sign up, log out and log in.

### Step 3: Bills list and the RLS test
- `/bills` lists only the current user's bills (query without any manual user filter, so RLS does the filtering). Each row links to `/bills/[id]`.
- Write `TESTING.md` with the two-user RLS test: user A uploads a bill, user B sees an empty list, and B opening A's bill URL shows nothing or an error.
- Done when: I can follow TESTING.md with two accounts and it passes.

### Step 4: Upload
- Form: bill type (lpg, electricity, broadband, phone, other), provider (optional), period dates (optional), photo.
- Server action: upload to `bill-images/<user id>/<uuid>.<ext>`, insert a `bill` row with `image_link` set to the storage path.
- Done when: the bill appears in `/bills` and the file is in the private bucket.

### Step 5: Read the bill into lines
- Server route `/api/extract`: create a short-lived signed URL for the photo, send it to the LLM with a prompt that returns ONLY JSON `[{ "label": string, "amount": number }]`. Validate with zod. Reject anything else.
- Strip account numbers, phone numbers and addresses from labels.
- Show the lines in an editable table so the user can fix mistakes. On confirm, insert `line_item` rows.
- Done when: a bill photo becomes confirmed line_item rows.

### Step 6: The promise
- Form on `/bills/[id]`: plan price, tax included (yes/no), discount, effective from, notes. Insert a `promise` row.
- Done when: I can save a promise for a bill.

### Step 7: Checks (pure code, with tests)
- `lib/checks.ts`: pure functions, no LLM, no network. Include: sum of lines vs total; tax as a percentage of the correct base; discount applied; subsidy and rounding; meter reading difference x rate when a rate is given; balance chain (opening + charges = closing); this bill vs the previous bill from the same provider (flag changed or new lines).
- Each check returns `{ rule, expected, actual, verdict }` where verdict is `ok`, `wrong` (contradicts the promise or the maths) or `unexplained` (maths is right but the line is new, changed or has no reason).
- `lib/checks.test.ts` with vitest, covering: a clean bill, GST on the base vs all-in (499 plan, 15% discount, 18% GST), an unexplained 2.50 drop between months, rounding of a few paise.
- Insert results as `check_result` rows. Never overwrite old ones.
- Done when: `npm test` passes and the bill page shows each check with its maths.

### Step 8: The message
- Server route `/api/message`: pass ONLY the check results (not the raw bill) to the LLM and ask for a short polite message in the user's tone about the single most important wrong or unexplained line.
- `lib/verifyMessage.ts`: extract every number from the message text and confirm each exists in the check results (amounts, expected, actual). If any does not: regenerate once, then fall back to a template message built by code.
- Insert a `message` row with `draft` and `line_item_id`.
- Done when: a message appears only when something is wrong or unexplained, with every amount verified.

### Step 9: Clean bill path
- If all checks are ok, show "Every line checks out" with the maths line by line. No message is generated.

### Step 10: Copy and send tracking
- "Copy message" button. A box where the user pastes or edits the text they actually sent. Save `sent_text`, `sent_at` and `words_changed` (word-level difference vs `draft`, computed by code).
- Done when: sending and editing a message updates the row.

### Step 11: Earlier bills
- On the bill page show the same label across the user's earlier bills (from line_item) so a charge that repeats or changes is visible.

### Step 12: Ship
- `README.md` with how to run, the three env vars, and how to run the RLS test.
- Confirm `.env.local` is not committed. Make sure `npm run build` passes and push to the public GitHub repo so Vercel deploys.

## Style
Keep it simple: a plain form UI is fine. Small files, clear names, no unused code. After every step tell me (1) what you changed, (2) how I verify it, (3) anything I must do by hand.
