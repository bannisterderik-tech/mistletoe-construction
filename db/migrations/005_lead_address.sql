-- Structured property address on leads, so address-only "instant quote" leads
-- (captured before the visitor enters contact info) are a clean direct-mail list.
-- Run ONCE in the Supabase SQL editor. Idempotent.
alter table leads
  add column if not exists address text;
