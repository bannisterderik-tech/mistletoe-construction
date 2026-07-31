-- Contract signing on proposals: records the owner's e-signature of the
-- Master Construction Agreement + acknowledgement of the Oregon Notice of
-- Right to a Lien (ORS 87.021). Safe to run more than once.
alter table public.proposals add column if not exists agreement_version   text;
alter table public.proposals add column if not exists agreement_signer     text;
alter table public.proposals add column if not exists agreement_cosigner   text;
alter table public.proposals add column if not exists agreement_signed_at   timestamptz;
alter table public.proposals add column if not exists agreement_signer_ip   text;
alter table public.proposals add column if not exists lien_notice_ack       boolean default false;
alter table public.proposals add column if not exists stripe_invoice_pdf     text;

-- 'signed' is a new status between 'sent' and 'invoiced'.
comment on column public.proposals.agreement_signed_at is 'When the owner e-signed the Master Construction Agreement.';
