-- ============================================================
--  Mistletoe — CONSOLIDATED schema migration (safe to run & re-run).
--  Creates/ensures: team_seats, assignment cols, role+RLS functions,
--  sales/field RLS, invoice Stripe cols, campaign_state.
--  Paste into Supabase SQL Editor -> Run. Ends with a verification query.
-- ============================================================
-- ============================================================
--  Mistletoe CRM — Team seats + assignment-based Row-Level Security
--  Safe to run and re-run (idempotent). Wrapped in a transaction.
--
--  Roles:  admin  (owner — sees everything)
--          sales  (open book — read all leads/customers/jobs, build proposals)
--          field  (strict — only jobs assigned to them + those jobs' customers/visits)
--          client (homeowner portal — unchanged)
-- ============================================================

-- ---------- team seats (who the staff are) ----------
create table if not exists public.team_seats (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  name       text,
  role       text not null default 'sales' check (role in ('sales','field')),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists team_seats_email_uidx on public.team_seats (lower(email));
alter table public.team_seats enable row level security;

-- ---------- assignment columns ----------
alter table public.leads     add column if not exists assigned_to uuid;
alter table public.jobs      add column if not exists assigned_to uuid;
alter table public.customers add column if not exists assigned_to uuid;

-- ---------- helper functions (SECURITY DEFINER so policies can read auth/seat data) ----------
create or replace function public.my_email() returns text
  language sql stable security definer set search_path = public, auth as $$
  select email from auth.users where id = auth.uid();
$$;

create or replace function public.my_seat_id() returns uuid
  language sql stable security definer set search_path = public as $$
  select id from public.team_seats
  where lower(email) = lower(public.my_email()) and active
  limit 1;
$$;

-- Effective role: allowlist admin > active team seat > profile role > client
create or replace function public.my_role() returns text
  language sql stable security definer set search_path = public as $$
  select case
    when public.is_admin() then 'admin'
    when exists (select 1 from public.team_seats t
                 where lower(t.email) = lower(public.my_email()) and t.active)
      then (select t.role from public.team_seats t
            where lower(t.email) = lower(public.my_email()) and t.active limit 1)
    else coalesce((select role from public.profiles where id = auth.uid()), 'client')
  end;
$$;

grant execute on function public.my_email()   to authenticated;
grant execute on function public.my_seat_id() to authenticated;
grant execute on function public.my_role()    to authenticated;

-- ---------- team_seats policies ----------
drop policy if exists team_seats_admin_all  on public.team_seats;
drop policy if exists team_seats_staff_read on public.team_seats;
create policy team_seats_admin_all  on public.team_seats for all
  using (public.is_admin()) with check (public.is_admin());
create policy team_seats_staff_read on public.team_seats for select
  using (public.my_role() in ('admin','sales','field'));

-- ---------- LEADS  (sales: open book · field: none) ----------
drop policy if exists leads_sales_read on public.leads;
drop policy if exists leads_sales_ins  on public.leads;
drop policy if exists leads_sales_upd  on public.leads;
create policy leads_sales_read on public.leads for select using (public.my_role() = 'sales');
create policy leads_sales_ins  on public.leads for insert with check (public.my_role() = 'sales');
create policy leads_sales_upd  on public.leads for update using (public.my_role() = 'sales') with check (public.my_role() = 'sales');

-- ---------- CUSTOMERS  (sales: open book · field: only assigned-job customers) ----------
drop policy if exists customers_sales_read  on public.customers;
drop policy if exists customers_sales_ins   on public.customers;
drop policy if exists customers_sales_upd   on public.customers;
drop policy if exists customers_field_read  on public.customers;
create policy customers_sales_read on public.customers for select using (public.my_role() = 'sales');
create policy customers_sales_ins  on public.customers for insert with check (public.my_role() = 'sales');
create policy customers_sales_upd  on public.customers for update using (public.my_role() = 'sales') with check (public.my_role() = 'sales');
create policy customers_field_read on public.customers for select using (
  public.my_role() = 'field' and (
    assigned_to = public.my_seat_id()
    or exists (select 1 from public.jobs j
               where j."customerId"::text = public.customers.id::text
                 and j.assigned_to = public.my_seat_id())
  )
);

-- ---------- JOBS  (sales: all · field: only assigned) ----------
drop policy if exists jobs_sales_read on public.jobs;
drop policy if exists jobs_sales_ins  on public.jobs;
drop policy if exists jobs_sales_upd  on public.jobs;
drop policy if exists jobs_field_read on public.jobs;
drop policy if exists jobs_field_upd  on public.jobs;
create policy jobs_sales_read on public.jobs for select using (public.my_role() = 'sales');
create policy jobs_sales_ins  on public.jobs for insert with check (public.my_role() = 'sales');
create policy jobs_sales_upd  on public.jobs for update using (public.my_role() = 'sales') with check (public.my_role() = 'sales');
create policy jobs_field_read on public.jobs for select using (public.my_role() = 'field' and assigned_to = public.my_seat_id());
create policy jobs_field_upd  on public.jobs for update using (public.my_role() = 'field' and assigned_to = public.my_seat_id())
  with check (public.my_role() = 'field' and assigned_to = public.my_seat_id());

-- ---------- VISITS  (sales: read all · field: for their assigned jobs' customers) ----------
drop policy if exists visits_sales_read on public.visits;
drop policy if exists visits_field_read on public.visits;
drop policy if exists visits_field_ins  on public.visits;
create policy visits_sales_read on public.visits for select using (public.my_role() = 'sales');
create policy visits_field_read on public.visits for select using (
  public.my_role() = 'field' and exists (
    select 1 from public.jobs j
    where j."customerId"::text = public.visits."customerId"::text
      and j.assigned_to = public.my_seat_id())
);
create policy visits_field_ins on public.visits for insert with check (
  public.my_role() = 'field' and exists (
    select 1 from public.jobs j
    where j."customerId"::text = public.visits."customerId"::text
      and j.assigned_to = public.my_seat_id())
);

-- ---------- PROPOSALS  (sales: full · field: none; admin policy already exists) ----------
drop policy if exists proposals_sales_all on public.proposals;
create policy proposals_sales_all on public.proposals for all
  using (public.my_role() = 'sales') with check (public.my_role() = 'sales');

-- ---------- invoices: Stripe linkage for CRM payment tracking ----------
alter table public.invoices add column if not exists stripe_invoice_id  text;
alter table public.invoices add column if not exists hosted_invoice_url text;



-- ---------- campaign_state (drives the 50/day realtor drip) ----------
create table if not exists public.campaign_state (
  email      text primary key,
  name       text,
  step       int  not null default 0,
  last_sent  date,
  status     text not null default 'active',
  updated_at timestamptz not null default now()
);
alter table public.campaign_state enable row level security;
drop policy if exists campaign_state_admin_all on public.campaign_state;
create policy campaign_state_admin_all on public.campaign_state for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------- verification (paste this output back to me) ----------
select 'tables_present' as check,
  string_agg(table_name, ', ' order by table_name) as value
from information_schema.tables
where table_schema='public'
  and table_name in ('team_seats','campaign_state','customers','leads','jobs','visits','invoices','partners','proposals')
union all
select 'my_role_fn', public.my_role()
union all
select 'invoice_stripe_cols',
  coalesce((select string_agg(column_name, ', ') from information_schema.columns
   where table_schema='public' and table_name='invoices' and column_name in ('stripe_invoice_id','hosted_invoice_url')), 'NONE');
