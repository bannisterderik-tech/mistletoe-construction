-- Guarantee admins can DELETE on every core table (idempotent, belt-and-suspenders).
do $$
declare t text;
begin
  foreach t in array array['customers','leads','jobs','visits','invoices','partners','proposals','team_seats','app_settings','campaign_state'] loop
    execute format('drop policy if exists %I on public.%I', t || '_admin_delete', t);
    execute format('create policy %I on public.%I for delete using (public.is_admin())', t || '_admin_delete', t);
  end loop;
end $$;
select 'admin delete policies ensured' as done;
