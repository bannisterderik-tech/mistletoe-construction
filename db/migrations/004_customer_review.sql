-- Customer-level review requests (manual "Request review" on the customer record,
-- for cash/check jobs that never had a proposal). Mirrors the proposal columns.
-- Run ONCE in the Supabase SQL editor. Idempotent.
alter table customers
  add column if not exists review_requested_at timestamptz,
  add column if not exists review_opened_at   timestamptz,
  add column if not exists review_open_count  int not null default 0,
  add column if not exists review_clicked_at  timestamptz,
  add column if not exists review_click_count int not null default 0;
