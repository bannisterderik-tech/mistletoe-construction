-- CRM wiring: connect jobs to deals, add lead follow-up + activity log.
-- Run ONCE in the Supabase SQL editor. Idempotent.

-- Jobs link back to their proposal (deal) + lead.
alter table jobs
  add column if not exists proposal_id text,
  add column if not exists lead_id text;
create index if not exists jobs_proposal_id_idx on jobs(proposal_id);

-- Leads: a next-action date + an append-only activity log (JSONB, no extra table/RLS).
alter table leads
  add column if not exists followup_at date,
  add column if not exists activity jsonb not null default '[]'::jsonb;
