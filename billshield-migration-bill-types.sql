-- Run once in Supabase > SQL Editor. Adds the new bill types; existing rows are untouched.
-- Tables, columns and RLS policies are not changed.

do $$
declare c text;
begin
  select conname into c
  from pg_constraint
  where conrelid = 'public.bill'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%bill_type%';
  if c is not null then
    execute format('alter table public.bill drop constraint %I', c);
  end if;
end $$;

alter table public.bill add constraint bill_bill_type_check check
  (bill_type in ('lpg','electricity','broadband','phone','restaurant','shopping','receipt','other'));
