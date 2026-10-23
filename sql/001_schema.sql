-- ============================================================================
-- Unaabs Smart Events — schema (PostgreSQL / Supabase)
-- Run files in order: 001_schema, 002_rls, 003_portal, 004_storage, 005_demo
-- Every business-owned table carries business_id. Child rows reference their
-- parent with a COMPOSITE foreign key (id, business_id) so a row can never point
-- at another business's customer/event, even by mistake.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------- profiles ---------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.email)
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- businesses -------------------------------------------------------
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  business_type text not null default 'multiple'
    check (business_type in ('catering','small_chops','wedding_planning','event_planning','decoration','multiple','other')),
  services text[] not null default '{}',
  phone text,
  whatsapp text,
  email text,
  location text,
  description text,
  welcome_message text,
  primary_color text not null default '#7A1F3D' check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  secondary_color text not null default '#0F7B5F' check (secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  logo_url text,
  cover_url text,
  currency text not null default 'NGN',
  plan text not null default 'free' check (plan in ('free','starter','professional','business')),
  booking_seq integer not null default 0,
  quote_seq integer not null default 0,
  onboarded boolean not null default false,
  created_at timestamptz not null default now()
);

-- Membership: owner now, manager/staff later (architecture ready, UI owner-only for v1)
create table public.business_members (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','manager','staff')),
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);
create index on public.business_members (user_id);

-- ---------- helper functions used by RLS ------------------------------------
create or replace function public.is_member(bid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.business_members
    where business_id = bid and user_id = auth.uid()
  );
$$;

create or replace function public.has_role(bid uuid, roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.business_members
    where business_id = bid and user_id = auth.uid() and role = any(roles)
  );
$$;

-- ---------- customers --------------------------------------------------------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  phone text,
  whatsapp text,
  email text,
  address text,
  preferred_contact text not null default 'whatsapp' check (preferred_contact in ('whatsapp','phone','email')),
  notes text,
  created_at timestamptz not null default now(),
  unique (id, business_id)
);
create index on public.customers (business_id, name);
create index on public.customers (business_id, phone);

-- ---------- events (bookings) -----------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null,
  booking_number text,
  name text not null check (char_length(name) between 1 and 160),
  event_type text not null default 'Wedding',
  event_date date not null,
  start_time time,
  end_time time,
  venue text,
  venue_address text,
  guest_count integer not null default 0 check (guest_count >= 0),
  description text,
  special_instructions text,
  services text[] not null default '{}',
  status text not null default 'inquiry' check (status in (
    'inquiry','quote_sent','awaiting_approval','confirmed','deposit_paid','planning',
    'final_details','ready','event_day','completed','cancelled')),
  discount numeric(14,2) not null default 0 check (discount >= 0),
  additional_charges numeric(14,2) not null default 0 check (additional_charges >= 0),
  delivery_fee numeric(14,2) not null default 0 check (delivery_fee >= 0),
  service_fee numeric(14,2) not null default 0 check (service_fee >= 0),
  deposit_required numeric(14,2) not null default 0 check (deposit_required >= 0),
  payment_due_date date,
  allow_overpayment boolean not null default false,
  internal_notes text,            -- PRIVATE. Never returned by the portal.
  customer_notes text,            -- Intentionally shared with the customer.
  next_step text,                 -- Shown on portal e.g. "Final guest count"
  next_step_due date,
  show_event_details boolean not null default true,
  show_services boolean not null default true,
  show_progress boolean not null default true,
  show_payment boolean not null default false,
  show_venue boolean not null default true,
  show_notes boolean not null default true,
  cover_image_url text,
  repeat_of uuid,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, business_id),
  foreign key (customer_id, business_id) references public.customers (id, business_id) on delete restrict
);
create index on public.events (business_id, event_date);
create index on public.events (business_id, status);
create index on public.events (business_id, customer_id);

-- SECURITY DEFINER: numbering must work for any member (future manager/staff roles), not only the
-- owner who is allowed to UPDATE businesses. It can only touch new.business_id, and the insert
-- itself is still checked by RLS (a failed insert rolls the counter back).
create or replace function public.events_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at = now();
  if tg_op = 'INSERT' and new.booking_number is null then
    update public.businesses set booking_seq = booking_seq + 1
      where id = new.business_id
      returning 'SE-' || lpad(booking_seq::text, 4, '0') into new.booking_number;
  end if;
  if new.status = 'completed' and new.completed_at is null then
    new.completed_at = now();
  end if;
  return new;
end $$;

create trigger events_before_write
  before insert or update on public.events
  for each row execute function public.events_before_write();

-- ---------- booking items ----------------------------------------------------
create table public.booking_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  event_id uuid not null,
  service text not null,
  description text,
  quantity numeric(12,2) not null default 1 check (quantity > 0),
  unit_price numeric(14,2) not null default 0 check (unit_price >= 0),
  sort integer not null default 0,
  foreign key (event_id, business_id) references public.events (id, business_id) on delete cascade
);
create index on public.booking_items (event_id);

-- ---------- payments (append-only: no update/delete policy) -----------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  event_id uuid not null,
  amount numeric(14,2) not null check (amount > 0),
  paid_on date not null default current_date,
  method text not null default 'bank_transfer' check (method in ('cash','bank_transfer','pos','other')),
  reference text,
  note text,
  created_at timestamptz not null default now(),
  foreign key (event_id, business_id) references public.events (id, business_id) on delete cascade
);
create index on public.payments (event_id);
create index on public.payments (business_id, paid_on);

-- ---------- financial view: balance is ALWAYS calculated, never stored -------
create or replace view public.event_financials
with (security_invoker = true) as
select
  e.id as event_id,
  e.business_id,
  coalesce(i.subtotal, 0) as subtotal,
  greatest(coalesce(i.subtotal, 0) - e.discount + e.additional_charges + e.delivery_fee + e.service_fee, 0) as total,
  coalesce(p.paid, 0) as paid,
  greatest(coalesce(i.subtotal, 0) - e.discount + e.additional_charges + e.delivery_fee + e.service_fee, 0) - coalesce(p.paid, 0) as balance,
  case
    when coalesce(p.paid, 0) <= 0 then 'awaiting_payment'
    when coalesce(p.paid, 0) >= greatest(coalesce(i.subtotal, 0) - e.discount + e.additional_charges + e.delivery_fee + e.service_fee, 0) then 'paid_in_full'
    else 'partially_paid'
  end as payment_status
from public.events e
left join (select event_id, sum(quantity * unit_price) as subtotal from public.booking_items group by event_id) i on i.event_id = e.id
left join (select event_id, sum(amount) as paid from public.payments group by event_id) p on p.event_id = e.id;

-- Overpayment guard (server-side, cannot be bypassed by the client)
create or replace function public.payments_guard()
returns trigger language plpgsql as $$
declare
  v_total numeric; v_paid numeric; v_allow boolean;
begin
  select total, paid into v_total, v_paid from public.event_financials where event_id = new.event_id;
  select allow_overpayment into v_allow from public.events where id = new.event_id;
  if not coalesce(v_allow, false) and (coalesce(v_paid, 0) + new.amount) > coalesce(v_total, 0) then
    raise exception 'OVERPAYMENT: payment exceeds the remaining balance' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger payments_guard
  before insert on public.payments
  for each row execute function public.payments_guard();

-- ---------- quotes -----------------------------------------------------------
create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  event_id uuid,
  customer_id uuid not null,
  quote_number text,
  title text not null,
  status text not null default 'draft' check (status in ('draft','sent','accepted','declined','expired')),
  issue_date date not null default current_date,
  expiry_date date,
  discount numeric(14,2) not null default 0 check (discount >= 0),
  additional_charges numeric(14,2) not null default 0 check (additional_charges >= 0),
  deposit_required numeric(14,2) not null default 0 check (deposit_required >= 0),
  terms text,
  notes text,
  created_at timestamptz not null default now(),
  unique (id, business_id),
  foreign key (customer_id, business_id) references public.customers (id, business_id) on delete restrict,
  foreign key (event_id, business_id) references public.events (id, business_id) on delete set null (event_id)
);
create index on public.quotes (business_id, created_at desc);

create or replace function public.quotes_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.quote_number is null then
    update public.businesses set quote_seq = quote_seq + 1
      where id = new.business_id
      returning 'Q-' || lpad(quote_seq::text, 4, '0') into new.quote_number;
  end if;
  return new;
end $$;
create trigger quotes_before_insert before insert on public.quotes
  for each row execute function public.quotes_before_insert();

create table public.quote_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  quote_id uuid not null,
  service text not null,
  description text,
  quantity numeric(12,2) not null default 1 check (quantity > 0),
  unit_price numeric(14,2) not null default 0 check (unit_price >= 0),
  sort integer not null default 0,
  foreign key (quote_id, business_id) references public.quotes (id, business_id) on delete cascade
);
create index on public.quote_items (quote_id);

-- ---------- vendors (PRIVATE to the business) -------------------------------
create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  service text not null default 'Other',
  phone text,
  whatsapp text,
  email text,
  notes text,
  created_at timestamptz not null default now(),
  unique (id, business_id)
);

create table public.event_vendors (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  event_id uuid not null,
  vendor_id uuid not null,
  price numeric(14,2) not null default 0 check (price >= 0),
  status text not null default 'not_contacted'
    check (status in ('not_contacted','contacted','confirmed','deposit_paid','completed','cancelled')),
  due_date date,
  notes text,
  created_at timestamptz not null default now(),
  unique (id, business_id),
  foreign key (event_id, business_id) references public.events (id, business_id) on delete cascade,
  foreign key (vendor_id, business_id) references public.vendors (id, business_id) on delete cascade
);
create index on public.event_vendors (event_id);

create table public.vendor_payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  event_vendor_id uuid not null,
  amount numeric(14,2) not null check (amount > 0),
  paid_on date not null default current_date,
  note text,
  created_at timestamptz not null default now(),
  foreign key (event_vendor_id, business_id) references public.event_vendors (id, business_id) on delete cascade
);
create index on public.vendor_payments (event_vendor_id);

-- ---------- expenses (PRIVATE) ----------------------------------------------
create table public.event_expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  event_id uuid,
  category text not null default 'Other',
  description text,
  amount numeric(14,2) not null check (amount > 0),
  spent_on date not null default current_date,
  created_at timestamptz not null default now(),
  foreign key (event_id, business_id) references public.events (id, business_id) on delete cascade
);
create index on public.event_expenses (event_id);
create index on public.event_expenses (business_id, spent_on);

-- ---------- tasks, checklist, appointments ----------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  event_id uuid,
  title text not null,
  due_date date,
  priority text not null default 'normal' check (priority in ('low','normal','high')),
  status text not null default 'todo' check (status in ('todo','in_progress','done')),
  notes text,
  created_at timestamptz not null default now(),
  foreign key (event_id, business_id) references public.events (id, business_id) on delete cascade
);
create index on public.tasks (business_id, status, due_date);

create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  event_id uuid not null,
  label text not null,
  done boolean not null default false,
  sort integer not null default 0,
  foreign key (event_id, business_id) references public.events (id, business_id) on delete cascade
);
create index on public.checklist_items (event_id);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  event_id uuid,
  title text not null,
  starts_at timestamptz not null,
  location text,
  notes text,
  customer_visible boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (event_id, business_id) references public.events (id, business_id) on delete cascade
);
create index on public.appointments (business_id, starts_at);

-- ---------- customer portals & access log -----------------------------------
create table public.customer_portals (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  event_id uuid not null,
  customer_id uuid not null,
  token_hash text not null unique,           -- SHA-256 hex of the raw token. Raw token is never stored.
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 days'),
  revoked_at timestamptz,
  last_accessed_at timestamptz,
  access_count integer not null default 0,
  foreign key (event_id, business_id) references public.events (id, business_id) on delete cascade,
  foreign key (customer_id, business_id) references public.customers (id, business_id) on delete cascade
);
create index on public.customer_portals (business_id, event_id);

-- Minimal log: only a timestamp. No IP addresses, no user agents.
create table public.portal_access (
  id uuid primary key default gen_random_uuid(),
  portal_id uuid not null references public.customer_portals(id) on delete cascade,
  accessed_at timestamptz not null default now()
);
create index on public.portal_access (portal_id, accessed_at desc);

-- ---------- templates, costings, follow-ups ---------------------------------
create table public.event_templates (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  event_type text not null default 'Wedding',
  guest_count integer not null default 0,
  services text[] not null default '{}',
  items jsonb not null default '[]',    -- [{service, description, quantity, unit_price}]
  notes text,
  created_at timestamptz not null default now()
);

create table public.catering_costings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  event_id uuid,
  name text not null,
  guests integer not null check (guests > 0),
  data jsonb not null,                  -- inputs
  total_cost numeric(14,2) not null default 0,
  selling_price numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  foreign key (event_id, business_id) references public.events (id, business_id) on delete set null (event_id)
);

create table public.small_chops_costings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  event_id uuid,
  name text not null,
  guests integer not null check (guests > 0),
  data jsonb not null,
  total_cost numeric(14,2) not null default 0,
  selling_price numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  foreign key (event_id, business_id) references public.events (id, business_id) on delete set null (event_id)
);

create table public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  event_id uuid not null,
  customer_id uuid not null,
  kind text not null default 'follow_up' check (kind in ('thank_you','feedback','review','photos','follow_up')),
  due_date date not null,
  done boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  foreign key (event_id, business_id) references public.events (id, business_id) on delete cascade,
  foreign key (customer_id, business_id) references public.customers (id, business_id) on delete cascade
);
create index on public.follow_ups (business_id, done, due_date);

-- ---------- create_business RPC (the only way to make a business) -----------
create or replace function public.create_business(
  p_name text, p_type text, p_phone text, p_whatsapp text, p_email text, p_location text,
  p_primary text, p_secondary text, p_description text, p_welcome text, p_services text[]
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_slug text; v_base text; v_n int := 0; v_id uuid;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if exists (select 1 from business_members where user_id = v_uid) then
    raise exception 'BUSINESS_EXISTS';
  end if;
  v_base := regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g');
  v_base := trim(both '-' from v_base);
  if v_base = '' then v_base := 'business'; end if;
  v_slug := v_base;
  while exists (select 1 from businesses where slug = v_slug) loop
    v_n := v_n + 1; v_slug := v_base || '-' || v_n;
  end loop;
  insert into businesses (owner_id, name, slug, business_type, phone, whatsapp, email, location,
      primary_color, secondary_color, description, welcome_message, services, onboarded)
  values (v_uid, trim(p_name), v_slug, coalesce(p_type, 'multiple'), p_phone, p_whatsapp, p_email, p_location,
      coalesce(p_primary, '#7A1F3D'), coalesce(p_secondary, '#0F7B5F'), p_description, p_welcome,
      coalesce(p_services, '{}'), true)
  returning id into v_id;
  insert into business_members (business_id, user_id, role) values (v_id, v_uid, 'owner');
  return v_id;
end $$;

revoke all on function public.create_business(text,text,text,text,text,text,text,text,text,text,text[]) from public, anon;
grant execute on function public.create_business(text,text,text,text,text,text,text,text,text,text,text[]) to authenticated;

-- Repeat booking: copies a booking into a brand-new one. The original is never touched.
create or replace function public.repeat_booking(p_event_id uuid, p_new_date date)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  src public.events%rowtype; v_new uuid;
begin
  select * into src from public.events where id = p_event_id;
  if not found or not public.is_member(src.business_id) then raise exception 'NOT_FOUND'; end if;
  insert into public.events (business_id, customer_id, name, event_type, event_date, start_time, end_time,
      venue, venue_address, guest_count, description, special_instructions, services, status,
      discount, additional_charges, delivery_fee, service_fee, deposit_required,
      internal_notes, customer_notes, show_event_details, show_services, show_progress,
      show_payment, show_venue, show_notes, repeat_of)
  values (src.business_id, src.customer_id, src.name || ' (repeat)', src.event_type, p_new_date, src.start_time, src.end_time,
      src.venue, src.venue_address, src.guest_count, src.description, src.special_instructions, src.services, 'inquiry',
      src.discount, src.additional_charges, src.delivery_fee, src.service_fee, src.deposit_required,
      src.internal_notes, null, src.show_event_details, src.show_services, src.show_progress,
      src.show_payment, src.show_venue, src.show_notes, src.id)
  returning id into v_new;
  insert into public.booking_items (business_id, event_id, service, description, quantity, unit_price, sort)
    select business_id, v_new, service, description, quantity, unit_price, sort
    from public.booking_items where event_id = p_event_id;
  insert into public.checklist_items (business_id, event_id, label, done, sort)
    select business_id, v_new, label, false, sort from public.checklist_items where event_id = p_event_id;
  return v_new;
end $$;
revoke all on function public.repeat_booking(uuid, date) from public, anon;
grant execute on function public.repeat_booking(uuid, date) to authenticated;
