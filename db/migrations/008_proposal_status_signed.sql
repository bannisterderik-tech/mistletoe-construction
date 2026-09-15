-- 008_proposal_status_signed.sql
-- proposals_status_check rejects 'signed', so _sign-contract.js's patch was
-- rejected wholesale and NO signature was ever recorded (36 sent, 0 invoiced).
-- The API now retries without the status, but allowing the value is the real fix.
-- Safe to run more than once.

alter table public.proposals drop constraint if exists proposals_status_check;
alter table public.proposals add constraint proposals_status_check
  check (status in ('draft','sent','signed','accepted','invoiced','paid','declined','dead'));

select 'ok' as check, status, count(*) from public.proposals group by status order by 2;
