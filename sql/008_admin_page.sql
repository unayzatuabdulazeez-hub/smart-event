create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from public, anon, authenticated;

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

create or replace function public.admin_panel_list()
returns table (email text, business text, access text, paid_until timestamptz, days_left int, signed_up timestamptz, note text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'NOT_ADMIN'; end if;
  return query select c.email, c.business, c.access, c.paid_until, c.days_left, c.signed_up, c.note from public.admin_customers() c;
end $$;

create or replace function public.admin_panel_activate(p_email text, p_days int default 30)
returns text language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'NOT_ADMIN'; end if;
  return public.admin_activate(p_email, p_days, null);
end $$;

create or replace function public.admin_panel_suspend(p_email text)
returns text language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'NOT_ADMIN'; end if;
  return public.admin_deactivate(p_email, null);
end $$;

revoke all on function public.is_platform_admin() from public, anon;
revoke all on function public.admin_panel_list() from public, anon;
revoke all on function public.admin_panel_activate(text, int) from public, anon;
revoke all on function public.admin_panel_suspend(text) from public, anon;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.admin_panel_list() to authenticated;
grant execute on function public.admin_panel_activate(text, int) to authenticated;
grant execute on function public.admin_panel_suspend(text) to authenticated;
