-- Guarantee admins can DELETE on every core table that exists (idempotent, safe to re-run).
do $$
declare t text;
begin
  foreach t in array array['customers','leads','jobs','visits','invoices','partners','proposals','team_seats','app_settings','campaign_state'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists %I on public.%I', t || '_admin_delete', t);
      execute format('create policy %I on public.%I for delete using (public.is_admin())', t || '_admin_delete', t);
    end if;
  end loop;
end $$;

select 'admin delete policies ensured' as done;
