-- Run once in Supabase > SQL Editor, BEFORE deploying this version of the app.
-- Adds nullable columns only; existing rows, tables and RLS policies are untouched.

-- A tariff the user was promised (electricity, water): rate per unit and an optional fixed charge.
alter table public.promise   add column if not exists unit_rate    numeric(12,4);
alter table public.promise   add column if not exists fixed_charge numeric(12,2);

-- Units and per-unit rate as printed on a bill line (kWh and rate per kWh, litres, nights...).
alter table public.line_item add column if not exists units numeric(14,3);
alter table public.line_item add column if not exists rate  numeric(12,4);
