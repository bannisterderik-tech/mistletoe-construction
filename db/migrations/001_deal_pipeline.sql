-- Mistletoe deal pipeline — full migration (all 3 phases + scheduled 2nd invoice).
-- Run ONCE in the Supabase SQL editor. Idempotent (safe to re-run).

-- ============ Proposal milestone / schedule / billing columns ============
alter table proposals
  add column if not exists lead_id text references leads(id),
  add column if not exists sent_at timestamptz,
  add column if not exists first_viewed_at timestamptz,
  add column if not exists last_viewed_at timestamptz,
  add column if not exists view_count int not null default 0,
  add column if not exists agreement_first_viewed_at timestamptz,
  add column if not exists agreement_view_count int not null default 0,
  add column if not exists accepted_at timestamptz,
  add column if not exists declined_at timestamptz,
  -- project timeline (owner-set on the proposal)
  add column if not exists project_start_at date,
  add column if not exists project_end_at date,
  -- split billing (100 = single full invoice = today's behavior; opt-in split)
  add column if not exists deposit_pct numeric not null default 100,
  add column if not exists job_completed_at timestamptz,
  add column if not exists deposit_invoice_id text,
  add column if not exists deposit_invoiced_at timestamptz,
  add column if not exists deposit_paid_at timestamptz,
  add column if not exists final_invoice_id text,
  add column if not exists final_invoiced_at timestamptz,
  add column if not exists final_paid_at timestamptz,
  -- scheduled auto 2nd/balance invoice
  add column if not exists second_payment_due_at date,
  add column if not exists auto_final_enabled boolean not null default false,
  add column if not exists final_hold boolean not null default false,
  add column if not exists final_notice_at timestamptz,
  -- bookkeeping
  add column if not exists refunded_at timestamptz,
  add column if not exists voided_at timestamptz,
  add column if not exists needs_review boolean not null default false;

create index if not exists proposals_lead_id_idx on proposals(lead_id);
create index if not exists proposals_second_due_idx on proposals(second_payment_due_at);

-- ============ Invoices ownership of split invoices ============
alter table invoices
  add column if not exists proposal_id text,
  add column if not exists kind text;   -- 'deposit' | 'final' | 'full' | null (legacy admin)

-- ============ Normalize legacy lead stage ============
update leads set stage = 'proposal_sent' where stage = 'quoted';

-- ============ BACKFILL: link proposals -> leads on a UNIQUE, OPEN name match ============
with candidate as (
  select p.id as proposal_id, l.id as lead_id,
         count(*) over (partition by p.id) as match_count
  from proposals p
  join customers c on c.id = p."customerId"
  join leads l on lower(btrim(l.name)) = lower(btrim(c.name)) and l.stage not in ('won','lost')
)
update proposals p set lead_id = candidate.lead_id
from candidate
where candidate.proposal_id = p.id and candidate.match_count = 1 and p.lead_id is null;

-- ============ BACKFILL: synthesize timestamps from `created` (noon America/LA) ============
update proposals
set sent_at = coalesce(sent_at, (created::timestamp + time '12:00') at time zone 'America/Los_Angeles')
where status in ('sent','accepted','signed','invoiced','paid');

update proposals set accepted_at = coalesce(accepted_at, agreement_signed_at)
where agreement_signed_at is not null;

update proposals
set deposit_pct = 100,
    final_paid_at = coalesce(final_paid_at, (created::timestamp + time '12:00') at time zone 'America/Los_Angeles')
where status = 'paid';

update invoices set kind = 'full' where kind is null and stripe_invoice_id is not null;

-- ============ AUDIT: proposals that could NOT be auto-linked (fix via "Link lead" in the UI) ============
-- select p.id, p.title, c.name as customer_name, p.status
-- from proposals p join customers c on c.id = p."customerId"
-- where p.lead_id is null order by p.created desc;
