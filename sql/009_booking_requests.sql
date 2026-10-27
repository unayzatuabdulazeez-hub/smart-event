create table if not exists public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  phone text not null check (char_length(phone) between 7 and 20),
  whatsapp text not null check (whatsapp ~ '^\d{10,15}$'),
  event_type text not null default 'Other' check (char_length(event_type) between 1 and 60),
  event_date date not null,
  guest_count integer check (guest_count is null or guest_count between 0 and 100000),
  services text[] not null default '{}' check (cardinality(services) <= 12),
  message text check (message is null or char_length(message) <= 1000),
  status text not null default 'new' check (status in ('new','accepted','declined')),
  event_id uuid references public.events(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists booking_requests_biz_idx on public.booking_requests (business_id, status, created_at desc);

alter table public.booking_requests enable row level security;
drop policy if exists booking_requests_sel on public.booking_requests;
drop policy if exists booking_requests_upd on public.booking_requests;
drop policy if exists booking_requests_del on public.booking_requests;
create policy booking_requests_sel on public.booking_requests for select using (public.is_member(business_id));
create policy booking_requests_upd on public.booking_requests for update
  using (public.is_active_member(business_id)) with check (public.is_active_member(business_id));
create policy booking_requests_del on public.booking_requests for delete using (public.is_active_member(business_id));
revoke all on public.booking_requests from anon;
revoke insert, truncate on public.booking_requests from authenticated;

create or replace function public.submit_booking_request(
  p_slug text, p_name text, p_phone text, p_whatsapp text, p_event_type text,
  p_event_date date, p_guest_count int, p_services text[], p_message text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_bid uuid; v_name text := btrim(coalesce(p_name, '')); v_msg text := nullif(btrim(coalesce(p_message, '')), '');
        v_svc text[];
begin
  select id into v_bid from public.businesses where slug = p_slug;
  if v_bid is null then raise exception 'NOT_FOUND'; end if;
  if not public.has_access(v_bid) then raise exception 'NOT_ACCEPTING'; end if;

  if char_length(v_name) not between 1 and 120 then raise exception 'BAD_NAME'; end if;
  if p_whatsapp is null or p_whatsapp !~ '^\d{10,15}$' then raise exception 'BAD_PHONE'; end if;
  if p_phone is null or char_length(p_phone) not between 7 and 20 then raise exception 'BAD_PHONE'; end if;
  if p_event_date is null or p_event_date < current_date or p_event_date > current_date + 1095 then raise exception 'BAD_DATE'; end if;
  if p_guest_count is not null and p_guest_count not between 0 and 100000 then raise exception 'BAD_GUESTS'; end if;
  if v_msg is not null and char_length(v_msg) > 1000 then raise exception 'BAD_MESSAGE'; end if;
  v_svc := coalesce(array(select left(btrim(s), 60) from unnest(coalesce(p_services, '{}')) s where btrim(s) <> '' limit 12), '{}');

  if (select count(*) from public.booking_requests where business_id = v_bid and created_at > now() - interval '1 hour') >= 20 then raise exception 'TOO_MANY'; end if;
  if (select count(*) from public.booking_requests where business_id = v_bid and whatsapp = p_whatsapp and created_at > now() - interval '1 day') >= 3 then raise exception 'TOO_MANY'; end if;
  if (select count(*) from public.booking_requests where business_id = v_bid and status = 'new') >= 300 then raise exception 'TOO_MANY'; end if;

  insert into public.booking_requests (business_id, name, phone, whatsapp, event_type, event_date, guest_count, services, message)
  values (v_bid, v_name, p_phone, p_whatsapp, left(btrim(coalesce(nullif(p_event_type, ''), 'Other')), 60), p_event_date, p_guest_count, v_svc, v_msg);
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.submit_booking_request(text, text, text, text, text, date, int, text[], text) from public, anon, authenticated;
grant execute on function public.submit_booking_request(text, text, text, text, text, date, int, text[], text) to service_role;

create or replace function public.accept_booking_request(p_id uuid)
returns uuid language plpgsql as $$
declare r public.booking_requests; v_cust uuid; v_event uuid;
begin
  select * into r from public.booking_requests where id = p_id;
  if r.id is null then raise exception 'NOT_FOUND'; end if;
  if r.status <> 'new' then raise exception 'ALREADY_HANDLED'; end if;

  select id into v_cust from public.customers where business_id = r.business_id and whatsapp = r.whatsapp order by created_at limit 1;
  if v_cust is null then
    insert into public.customers (business_id, name, phone, whatsapp, preferred_contact)
    values (r.business_id, r.name, r.phone, r.whatsapp, 'whatsapp') returning id into v_cust;
  end if;

  v_event := public.create_booking(jsonb_build_object(
    'business_id', r.business_id, 'customer_id', v_cust,
    'name', left(r.name || ' - ' || r.event_type, 160), 'event_type', r.event_type, 'event_date', r.event_date,
    'guest_count', coalesce(r.guest_count, 0), 'services', to_jsonb(r.services), 'status', 'inquiry',
    'description', r.message));

  update public.booking_requests set status = 'accepted', event_id = v_event where id = p_id;
  return v_event;
end $$;
revoke all on function public.accept_booking_request(uuid) from public, anon;
grant execute on function public.accept_booking_request(uuid) to authenticated;
