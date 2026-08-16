-- 006_nurture.sql — lead-nurture drip state on the leads table.
-- Run this in the Supabase SQL editor (the MCP is scoped to the wrong org).
-- Safe to run more than once.

alter table if exists leads add column if not exists nurture_stage   integer     not null default 0;
alter table if exists leads add column if not exists nurture_last_at timestamptz;
alter table if exists leads add column if not exists nurture_stop    boolean     not null default false;

-- Backfill any pre-existing rows to explicit defaults (no-op if already set).
update leads set nurture_stage = 0     where nurture_stage is null;
update leads set nurture_stop  = false where nurture_stop  is null;

-- Speeds up the daily "who's due for the next nurture email?" scan.
create index if not exists idx_leads_nurture on leads (nurture_stop, nurture_stage, created);
