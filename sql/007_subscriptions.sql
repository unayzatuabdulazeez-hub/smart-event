-- ============================================================================
-- 007: Paid access. Manual bank-transfer subscriptions, controlled by the owner
-- of the platform (you), never by customers.
--
--  * Every business gets a subscription row (inactive until you activate it).
--  * Customers can READ their own subscription. They can never change it.
--  * While a subscription is not active (or has expired) the database itself
--    refuses writes to the business's data, so the lock cannot be bypassed by
--    calling the API directly. Existing data stays readable.
--  * You activate / extend / suspend customers from the Supabase SQL Editor with
--    admin_activate(), admin_deactivate() and admin_customers(). Those functions
--    are NOT callable from the website or from any customer session.
--  * Bank details shown on the payment screen live in platform_settings, so you
--    can change them without redeploying.
-- ============================================================================

-- ---------- subscriptions ----------------------------------------------------
create table if not exists public.subscriptions (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  status text not null default 'inactive' check (status in ('inactive','active','suspended')),
  paid_until timestamptz,
  activated_at timestamptz,
  note text,
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
drop policy if exists subscriptions_sel on public.subscriptions;
create policy subscriptions_sel on public.subscriptions for select using (public.is_member(business_id));
-- No insert/update/delete policy for anyone but the service/admin side; revoke the table privileges too.
revoke insert, update, delete, truncate on public.subscriptions from anon, authenticated;
revoke all on public.subscriptions from anon;

create or replace function public.has_access(bid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.subscriptions s
    where s.business_id = bid and s.status = 'active' and s.paid_until is not null and s.paid_until > now()
  );
$$;

create or replace function public.is_active_member(bid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_member(bid) and public.has_access(bid);
$$;

-- every new business starts inactive
create or replace function public.subscriptions_on_business()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.subscriptions (business_id) values (new.id) on conflict do nothing;
  return new;
end $$;
drop trigger if exists businesses_create_subscription on public.businesses;
create trigger businesses_create_subscription after insert on public.businesses
  for each row execute function public.subscriptions_on_business();

-- backfill for businesses that already exist
insert into public.subscriptions (business_id) select id from public.businesses on conflict do nothing;

-- ---------- platform settings (bank details etc.) ----------------------------
create table if not exists public.platform_settings (
  key text primary key,
  value text not null default ''
);
alter table public.platform_settings enable row level security;
drop policy if exists platform_settings_sel on public.platform_settings;
create policy platform_settings_sel on public.platform_settings for select to authenticated using (true);
revoke insert, update, delete, truncate on public.platform_settings from anon, authenticated;
revoke all on public.platform_settings from anon;
insert into public.platform_settings (key, value) values
  ('monthly_price', '2999'), ('bank_name', ''), ('account_name', ''), ('account_number', ''), ('support_whatsapp', '')
on conflict (key) do nothing;

-- ---------- the write lock ----------------------------------------------------
-- Re-create the insert/update/delete policies so they require an ACTIVE subscription.
-- SELECT policies are unchanged: an expired customer can still see their data.
do $$
declare t text;
begin
  foreach t in array array[
    'customers','events','booking_items','quotes','quote_items','vendors','event_vendors',
    'vendor_payments','event_expenses','tasks','checklist_items','appointments',
    'event_templates','catering_costings','small_chops_costings','follow_ups'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_ins', t);
    execute format('drop policy if exists %I on public.%I', t || '_upd', t);
    execute format('drop policy if exists %I on public.%I', t || '_del', t);
    execute format('create policy %I on public.%I for insert with check (public.is_active_member(business_id))', t || '_ins', t);
    execute format('create policy %I on public.%I for update using (public.is_active_member(business_id)) with check (public.is_active_member(business_id))', t || '_upd', t);
    execute format('create policy %I on public.%I for delete using (public.is_active_member(business_id))', t || '_del', t);
  end loop;
end $$;

drop policy if exists payments_ins on public.payments;
create policy payments_ins on public.payments for insert with check (public.is_active_member(business_id));

drop policy if exists portals_ins on public.customer_portals;
drop policy if exists portals_upd on public.customer_portals;
create policy portals_ins on public.customer_portals for insert with check (public.is_active_member(business_id));
create policy portals_upd on public.customer_portals for update
  using (public.is_active_member(business_id)) with check (public.is_active_member(business_id));

-- image uploads need an active subscription too
do $$
declare b text;
begin
  foreach b in array array['branding','event-images'] loop
    execute format('drop policy if exists %I on storage.objects', b || '_ins');
    execute format('drop policy if exists %I on storage.objects', b || '_upd');
    execute format($f$create policy %I on storage.objects for insert to authenticated
      with check (bucket_id = %L and public.is_active_member(public.storage_business_id(name)))$f$, b || '_ins', b);
    execute format($f$create policy %I on storage.objects for update to authenticated
      using (bucket_id = %L and public.is_active_member(public.storage_business_id(name)))
      with check (bucket_id = %L and public.is_active_member(public.storage_business_id(name)))$f$, b || '_upd', b, b);
  end loop;
end $$;

-- The two SECURITY DEFINER writers bypass RLS, so they get an explicit guard.
-- (Wrap the originals instead of copying their bodies.)
do $$
begin
  if not exists (select 1 from pg_proc where proname = 'repeat_booking_impl' and pronamespace = 'public'::regnamespace) then
    alter function public.repeat_booking(uuid, date) rename to repeat_booking_impl;
  end if;
  if not exists (select 1 from pg_proc where proname = 'seed_demo_data_impl' and pronamespace = 'public'::regnamespace) then
    alter function public.seed_demo_data() rename to seed_demo_data_impl;
  end if;
end $$;
revoke all on function public.repeat_booking_impl(uuid, date) from public, anon, authenticated;
revoke all on function public.seed_demo_data_impl() from public, anon, authenticated;

create or replace function public.repeat_booking(p_event_id uuid, p_new_date date)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_bid uuid;
begin
  select business_id into v_bid from public.events where id = p_event_id;
  if v_bid is null or not public.is_member(v_bid) then raise exception 'NOT_FOUND'; end if;
  if not public.has_access(v_bid) then raise exception 'SUBSCRIPTION_INACTIVE'; end if;
  return public.repeat_booking_impl(p_event_id, p_new_date);
end $$;
revoke all on function public.repeat_booking(uuid, date) from public, anon;
grant execute on function public.repeat_booking(uuid, date) to authenticated;

create or replace function public.seed_demo_data()
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_bid uuid;
begin
  select business_id into v_bid from public.business_members where user_id = auth.uid() limit 1;
  if v_bid is null then raise exception 'NO_BUSINESS'; end if;
  if not public.has_access(v_bid) then raise exception 'SUBSCRIPTION_INACTIVE'; end if;
  return public.seed_demo_data_impl();
end $$;
revoke all on function public.seed_demo_data() from public, anon;
grant execute on function public.seed_demo_data() to authenticated;

-- ---------- admin tools (run from the Supabase SQL Editor only) ---------------
-- Activate or extend a customer by the email they signed up with.
--   select public.admin_activate('customer@email.com');        -- 30 days
--   select public.admin_activate('customer@email.com', 60);    -- 60 days
-- Extending adds to whatever time is left, so early renewals lose nothing.
create or replace function public.admin_activate(p_email text, p_days int default 30, p_note text default null)
returns text language plpgsql security definer set search_path = public as $$
declare v_bid uuid; v_until timestamptz;
begin
  if p_days is null or p_days < 1 or p_days > 400 then raise exception 'BAD_DAYS'; end if;
  select b.id into v_bid from public.businesses b join auth.users u on u.id = b.owner_id
    where lower(u.email) = lower(trim(p_email));
  if v_bid is null then raise exception 'NO_BUSINESS_FOR_EMAIL'; end if;
  update public.subscriptions
     set status = 'active',
         paid_until = greatest(coalesce(paid_until, now()), now()) + make_interval(days => p_days),
         activated_at = coalesce(activated_at, now()),
         note = coalesce(p_note, note),
         updated_at = now()
   where business_id = v_bid
   returning paid_until into v_until;
  return 'Active until ' || to_char(v_until at time zone 'Africa/Lagos', 'DD Mon YYYY HH24:MI') || ' (Lagos time)';
end $$;

-- Switch a customer off immediately (e.g. refund or abuse).
create or replace function public.admin_deactivate(p_email text, p_note text default null)
returns text language plpgsql security definer set search_path = public as $$
declare v_bid uuid;
begin
  select b.id into v_bid from public.businesses b join auth.users u on u.id = b.owner_id
    where lower(u.email) = lower(trim(p_email));
  if v_bid is null then raise exception 'NO_BUSINESS_FOR_EMAIL'; end if;
  update public.subscriptions set status = 'suspended', note = coalesce(p_note, note), updated_at = now()
   where business_id = v_bid;
  return 'Suspended';
end $$;

-- See everyone: select * from public.admin_customers();
create or replace function public.admin_customers()
returns table (email text, business text, access text, paid_until timestamptz, days_left int, signed_up timestamptz, note text)
language sql se security definer set search_path = public as $$
  select u.email::text, b.name,
         case when s.status = 'active' and s.paid_until > now() then 'active'
              when s.status = 'active' then 'expired'
              else s.status end,
         s.paid_until,
         case when s.paid_until > now() then ceil(extract(epoch from (s.paid_until - now())) / 86400)::int else 0 end,
         b.created_at, s.note
  from public.businesses b
  join auth.users u on u.id = b.owner_id
  join public.subscriptions s on s.business_id = b.id
  order by b.created_at desc;
$$;

revoke all on function public.admin_activate(text, int, text) from public, anon, authenticated;
revoke all on function public.admin_deactivate(text, text) from public, anon, authenticated;
revoke all on function public.admin_customers() from public, anon, authenticated;
revoke all on function public.has_access(uuid) from public, anon;
grant execute on function public.has_access(uuid) to authenticated, service_role;
revoke all on function public.is_active_member(uuid) from public, anon;
grant execute on function public.is_active_member(uuid) to authenticated, service_role;
