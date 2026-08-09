-- Review requests + open/click tracking. Run ONCE in the Supabase SQL editor. Idempotent.
alter table proposals
  add column if not exists review_requested_at timestamptz,
  add column if not exists review_opened_at timestamptz,
  add column if not exists review_open_count int not null default 0,
  add column if not exists review_clicked_at timestamptz,
  add column if not exists review_click_count int not null default 0;
