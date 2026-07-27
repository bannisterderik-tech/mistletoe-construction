-- Owner-adjustable settings (roof pricing, etc.). Safe to run & re-run.
create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
drop policy if exists app_settings_admin_all on public.app_settings;
create policy app_settings_admin_all on public.app_settings for all
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists app_settings_read on public.app_settings;
create policy app_settings_read on public.app_settings for select using (true);

-- seed default roof pricing (only if not already set)
insert into public.app_settings (key, value) values
  ('roof_pricing', '{"waste":1.10,"rangeLow":0.90,"rangeHigh":1.12,"bands":{"flat":650,"b34":475,"b56":600,"b78":775},"materials":{"asphalt":1.0,"metal":1.9,"tile":2.2,"flat":1.1}}'::jsonb)
on conflict (key) do nothing;

select key, value from public.app_settings where key='roof_pricing';
