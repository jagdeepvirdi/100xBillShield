# Testing

## RLS test (two users)

Goal: a user can only see their own bills.

Upload does not exist until Step 4, so create the test bill with SQL.

1. Sign up two accounts, **A** and **B** (for example `a@test.com` and `b@test.com`). Turn off "Confirm email" in Supabase (Authentication > Sign In / Providers > Email) or confirm both by hand.
2. In the Supabase SQL editor (it runs as admin and ignores RLS), insert a bill for A:

   ```sql
   insert into public.bill (user_id, provider, bill_type)
   select id, 'Test Provider', 'lpg' from auth.users where email = 'a@test.com'
   returning id;
   ```

   Copy the returned `id`.
3. Log in as **A** at `/login`. `/bills` lists "Test Provider - lpg". Click it: the bill page opens. Copy its URL (`/bills/<id>`).
4. Log out. Log in as **B**.
5. `/bills` shows "No bills yet."
6. Open A's bill URL in B's session. Expected: a 404 page, with no bill data shown.

Pass = steps 3, 5 and 6 behave as described.

When Step 4 is done, you can replace step 2 by uploading a bill as A through the form.
