# Mistletoe — database schema reference

The base tables and the `is_admin()` / `profiles` primitives were created in the
Supabase dashboard before these migrations existed, so they are **not** in a
numbered migration file. This document is the version-controlled record of what
the application code depends on. If you ever rebuild the project from scratch,
recreate these first, then run the migrations in order.

## Migration order
1. *(base schema — see below, created in the dashboard originally)*
2. `000_consolidated.sql` — team_seats, assignment columns, `my_role`/`my_seat_id`/`my_email`, sales/field/admin RLS, invoice Stripe columns, `campaign_state`.
3. `app_settings.sql` — `app_settings` key/value table + seed `roof_pricing`.
4. `admin_delete.sql` — admin delete policies across core tables.
5. `contracts.sql` — agreement e-signature columns on `proposals`.

## Base tables (columns the code reads/writes)

- **profiles** `(id uuid pk = auth.uid, role text, "customerId" text)` — links an auth user to a role / customer.
- **customers** `(id text pk, name, phone, email, address, city, member bool, notes, assigned_to uuid)`
- **leads** `(id text pk, name, phone, email?, city, service, stage, note, created date, assigned_to uuid)`
- **jobs** `(id text pk, "customerId" text, title, status, start date, value numeric, note, assigned_to uuid)`
- **visits** `(id text pk, "customerId" text, type, date, summary, photos int)`
- **invoices** `(id text pk, "customerId" text, kind, label, amount numeric, status, date, stripe_invoice_id, hosted_invoice_url)`
- **partners** `(id, name, company, phone, email, notes, ...)`
- **proposals** `(id text pk, "customerId" text, title, items jsonb, amount numeric, status, token text, note, created date,
  stripe_invoice_id, stripe_invoice_url, stripe_invoice_pdf, agreement_* [see contracts.sql])`
- **team_seats**, **campaign_state**, **app_settings** — created by the migrations above.

> Note the quoted camelCase column `"customerId"` — PostgREST needs it quoted; the code
> uses `customerId` in JSON, which maps to the quoted column.

## Functions
- **is_admin() → bool** — owner allowlist (checks the caller's email/profile against the admin list). Used by every admin RLS policy.
- **my_email() / my_seat_id() / my_role()** — defined in `000_consolidated.sql`.

## RLS summary
RLS is **enabled** on all core tables. Effective role = `admin` (allowlist) > active team seat (`sales`/`field`) > `profiles.role` > `client`.
- admin: full access via `is_admin()`.
- sales: open book on leads/customers/jobs/visits/proposals.
- field: only assigned jobs + those jobs' customers/visits.
- client: own records only (portal).
- Server functions that must bypass RLS (public forms, token-gated proposal reads, Stripe webhooks) use the **service role key** (env only) via `api/_supabase.js`.
