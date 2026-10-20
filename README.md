# BillShield

Upload a bill (photo or PDF), say what you were promised, and BillShield finds the line that does not add up and writes one message you can send to the company. If every line checks out, it says so and shows the maths.

Every number you see or send is computed by code. The AI only does two things: it reads the bill into lines, and it words the message. Code then checks that every amount in the message exists in the check results. If one does not, it regenerates once and then falls back to a plain message built by code.

Stack: Next.js (App Router, TypeScript), Supabase (auth, Postgres, storage), Claude for reading and wording, with Gemini as an optional backup.

## Run it locally

1. Install: `npm install`
2. Create a Supabase project. In the SQL editor, run `billshield-schema.sql` once. It creates the tables, the row-level security policies and the private `bill-images` bucket.
3. In Supabase, go to Authentication > Sign In / Providers > Email. For quick local testing, turn off "Confirm email".
4. Copy `.env.example` to `.env.local` and fill in the values (below).
5. Start: `npm run dev`, then open http://localhost:3000 and sign up.

Other commands: `npm test` (vitest), `npm run build`.

## Environment variables

| Name | Needed | What it is |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL (Project Settings > API) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Supabase anon key (same page). Safe for the browser because row-level security protects the data. |
| `ANTHROPIC_API_KEY` | yes | Server only. Used to read bills and word messages. |
| `GEMINI_API_KEY` | optional | Server only. Backup used when the Anthropic key is missing, out of credit or rate limited. |
| `GEMINI_MODEL` | optional | Overrides the default Gemini model (`gemini-3.8-flash`). |

Never put a key behind a `NEXT_PUBLIC_` prefix, and never commit `.env.local` (it is gitignored).

## Run the RLS test

Row-level security is what stops one user seeing another's bills. Follow the two-user test in [TESTING.md](TESTING.md): user A uploads a bill, user B sees an empty list, and B opening A's bill URL shows a 404.

## Deploy

Push to GitHub, import the repo in Vercel, and add the same environment variables in the project settings. Vercel builds with `npm run build`.

## How it works

1. **Upload** a JPG, PNG, WebP or PDF (up to 4 MB, because Vercel limits request bodies to 4.5 MB). It is stored in the private `bill-images` bucket under `<user id>/<uuid>.<ext>`.
2. **Read** the bill into lines. You correct them in a table and confirm.
3. **Promise**: plan price, tax included or not, discount percentage, effective date, notes.
4. **Checks** (`lib/checks.ts`, pure code with tests): sum against total, tax on the correct base, discount applied, rounding, meter reading times rate, balance chain, and this bill against the previous one from the same provider. Each check gives `ok`, `wrong` or `unexplained`.
5. **Message**: the most important wrong or unexplained line becomes a short message. Only the check results go to the AI, and every number in the reply is verified.
6. **Send tracking**: copy the message, then paste what you actually sent. BillShield records the date and how many words you changed.

Account numbers, phone numbers and addresses are stripped before anything is stored.
