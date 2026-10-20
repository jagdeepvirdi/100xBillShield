# Testing

## RLS test (two users)

Goal: a user can only see their own bills.

1. Sign up two accounts, **A** and **B** (for example `a@test.com` and `b@test.com`). Turn off "Confirm email" in Supabase (Authentication > Sign In / Providers > Email) or confirm both by hand.
2. Log in as **A** at `/login`, click **Upload a bill**, choose a type, set the provider to "Test Provider", pick any photo or PDF and upload it.
3. `/bills` lists "Test Provider - lpg". Click it: the bill page opens. Copy its URL (`/bills/<id>`).
4. Log out. Log in as **B**.
5. `/bills` shows "No bills yet."
6. Open A's bill URL in B's session. Expected: a 404 page, with no bill data shown.

Pass = steps 3, 5 and 6 behave as described.

## Unit tests

`npm test` runs the pure code: the checks, the message number verifier, the word-change count and the earlier-bills matching.
