-- BillShield schema for Supabase (Postgres)
-- Run the whole file once in Supabase > SQL Editor.
-- Tables match Diagram 2: bill, promise, line_item, check_result, message.
-- The users table is Supabase's own auth.users, so it is not created here.
-- History is rows: nothing here overwrites an earlier bill, check or message.
-- Not stored on purpose: account numbers, phone numbers, addresses.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------

create table public.bill (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  provider     text,
  bill_type    text not null check (bill_type in ('lpg','electricity','broadband','phone','other')),
  period_start date,
  period_end   date,
  image_link   text,                 -- storage path of the masked photo, not the bytes
  created_at   timestamptz not null default now()
);

create table public.promise (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  bill_id        uuid not null references public.bill(id) on delete cascade,
  plan_price     numeric(12,2),
  tax_included   boolean,
  discount       numeric(12,2),
  effective_from date,
  notes          text,
  created_at     timestamptz not null default now()
);

create table public.line_item (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  bill_id    uuid not null references public.bill(id) on delete cascade,
  line_no    int,
  label      text not null,
  amount     numeric(12,2) not null,
  created_at timestamptz not null default now()
);

create table public.check_result (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  bill_id      uuid not null references public.bill(id) on delete cascade,
  line_item_id uuid references public.line_item(id) on delete cascade,
  rule         text not null,
  expected     numeric(12,2),
  actual       numeric(12,2),
  verdict      text not null check (verdict in ('ok','wrong','unexplained')),
  created_at   timestamptz not null default now()
);

-- Proof link: every message points at the line item it disputes.
create table public.message (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  bill_id       uuid not null references public.bill(id) on delete cascade,
  line_item_id  uuid not null references public.line_item(id) on delete cascade,
  draft         text not null,
  sent_text     text,               -- what the user actually sent
  words_changed int,                -- counted, not guessed
  sent_at       timestamptz,
  created_at    timestamptz not null default now()
);

create index on public.bill(user_id);
create index on public.promise(bill_id);
create index on public.line_item(bill_id);
create index on public.check_result(bill_id);
create index on public.check_result(line_item_id);
create index on public.message(bill_id);
create index on public.message(line_item_id);

-- ---------------------------------------------------------------
-- Row-level security: each user sees and writes only their own rows.
-- Child tables also require that the parent row belongs to the same user,
-- so nobody can attach rows to someone else's bill by guessing an id.
-- ---------------------------------------------------------------

alter table public.bill         enable row level security;
alter table public.promise      enable row level security;
alter table public.line_item    enable row level security;
alter table public.check_result enable row level security;
alter table public.message      enable row level security;

create policy "own bills" on public.bill
  for all to authenticated
  using      (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "own promises" on public.promise
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.bill b where b.id = bill_id and b.user_id = (select auth.uid()))
  );

create policy "own line items" on public.line_item
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.bill b where b.id = bill_id and b.user_id = (select auth.uid()))
  );

create policy "own check results" on public.check_result
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.bill b where b.id = bill_id and b.user_id = (select auth.uid()))
  );

create policy "own messages" on public.message
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.bill b where b.id = bill_id and b.user_id = (select auth.uid()))
    and exists (select 1 from public.line_item l where l.id = line_item_id and l.user_id = (select auth.uid()))
  );

-- ---------------------------------------------------------------
-- File storage: private bucket for bill photos.
-- Upload to the path  <user id>/<anything>.jpg  so the policy can match the folder.
-- ---------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('bill-images', 'bill-images', false)
on conflict (id) do nothing;

create policy "own bill images read" on storage.objects
  for select to authenticated
  using (bucket_id = 'bill-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "own bill images insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'bill-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "own bill images delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'bill-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
