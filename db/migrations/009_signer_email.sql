-- 009_signer_email.sql — capture WHO actually signed when a proposal link is
-- forwarded (agent -> trustee, PM -> owner, kid -> parent). Safe to re-run.
alter table public.proposals add column if not exists agreement_signer_email text;
comment on column public.proposals.agreement_signer_email is
  'Email of the person who e-signed — may differ from the customer record (forwarded link).';
