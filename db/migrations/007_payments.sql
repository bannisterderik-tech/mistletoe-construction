-- 007_payments.sql — cash/check/card payment records + numbered receipts.
-- Run in the Supabase SQL editor (the MCP is scoped to the wrong org).
-- Safe to run more than once.

-- Sequential, professional receipt numbers: MC-2026-0001, MC-2026-0002, …
create sequence if not exists public.receipt_seq start 1;

create table if not exists public.payments (
  id             text primary key,
  "customerId"   text,
  invoice_id     text,
  proposal_id    text,
  amount         numeric not null default 0,
  method         text not null default 'cash' check (method in ('cash','check','card','other')),
  reference      text,                       -- check number / memo / stripe id
  paid_on        date not null default current_date,
  note           text,
  receipt_number text not null default ('MC-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.receipt_seq')::text, 4, '0')),
  receipt_sent_at timestamptz,
  receipt_email  text,
  created_by     uuid,
  created_at     timestamptz not null default now()
);

create index if not exists payments_customer_idx on public.payments ("customerId");
create index if not exists payments_invoice_idx  on public.payments (invoice_id);
create unique index if not exists payments_receipt_uidx on public.payments (receipt_number);

-- RLS — writes go through the service role (API) which bypasses RLS; these
-- policies let the admin UI (user session) READ the rows. Mirrors team_seats_rls.
alter table public.payments enable row level security;
drop policy if exists payments_staff_read on public.payments;
drop policy if exists payments_admin_all  on public.payments;
create policy payments_staff_read on public.payments for select
  using (public.my_role() in ('admin','sales','field'));
create policy payments_admin_all  on public.payments for all
  using (public.is_admin()) with check (public.is_admin());

select 'payments ready' as check,
  (select count(*)::text from public.payments) as rows,
  (select last_value::text from public.receipt_seq) as seq;
