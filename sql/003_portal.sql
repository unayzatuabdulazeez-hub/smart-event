-- ============================================================================
-- Customer portal read function.
-- Called ONLY from the Next.js server route with the service-role key, passing the
-- SHA-256 hash of the token from the URL. Browsers/anon cannot execute it.
-- It returns a whitelist of fields. Internal notes, vendor costs, expenses, profit,
-- other customers, other events and database ids are never part of the result.
-- ============================================================================

create or replace function public.get_portal(p_token_hash text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  p public.customer_portals%rowtype;
  e public.events%rowtype;
  b public.businesses%rowtype;
  c public.customers%rowtype;
  f record;
  v_deposit_ok boolean;
  v_appt jsonb;
  v_services jsonb;
  v_menu boolean;
  v_guests boolean;
begin
  select * into p from public.customer_portals where token_hash = p_token_hash;
  if not found then return jsonb_build_object('state', 'invalid'); end if;
  if p.revoked_at is not null then return jsonb_build_object('state', 'revoked'); end if;
  if p.expires_at <= now() then return jsonb_build_object('state', 'expired'); end if;

  select * into e from public.events where id = p.event_id and business_id = p.business_id;
  select * into b from public.businesses where id = p.business_id;
  select * into c from public.customers where id = p.customer_id and business_id = p.business_id;
  select * into f from public.event_financials where event_id = e.id;

  update public.customer_portals
    set last_accessed_at = now(), access_count = access_count + 1 where id = p.id;
  insert into public.portal_access (portal_id) values (p.id);

  v_deposit_ok := coalesce(f.paid, 0) > 0 and coalesce(f.paid, 0) >= least(e.deposit_required, coalesce(f.total, 0));

  select coalesce(jsonb_agg(jsonb_build_object('title', a.title, 'starts_at', a.starts_at, 'location', a.location)
           order by a.starts_at), '[]'::jsonb)
    into v_appt
    from public.appointments a
    where a.event_id = e.id and a.business_id = e.business_id and a.customer_visible and a.starts_at >= now();

  select coalesce(bool_or(done) filter (where label = 'Menu confirmed'), false),
         coalesce(bool_or(done) filter (where label = 'Guest count confirmed'), false)
    into v_menu, v_guests
    from public.checklist_items where event_id = e.id and business_id = e.business_id;

  select coalesce(jsonb_agg(distinct bi.service), '[]'::jsonb) into v_services
    from public.booking_items bi where bi.event_id = e.id;

  return jsonb_build_object(
    'state', 'ok',
    'business', jsonb_build_object(
      'name', b.name, 'logo_url', b.logo_url, 'cover_url', b.cover_url,
      'primary_color', b.primary_color, 'secondary_color', b.secondary_color,
      'welcome_message', b.welcome_message, 'phone', b.phone, 'whatsapp', b.whatsapp,
      'email', b.email, 'location', b.location, 'business_type', b.business_type),
    'customer_first_name', split_part(c.name, ' ', 1),
    'event', jsonb_build_object(
      'name', e.name, 'event_type', e.event_type, 'event_date', e.event_date,
      'status', e.status, 'cover_image_url', e.cover_image_url,
      'guest_count', case when e.show_event_details then e.guest_count else null end,
      'start_time', case when e.show_event_details then e.start_time else null end,
      'end_time', case when e.show_event_details then e.end_time else null end,
      'venue', case when e.show_venue then e.venue else null end,
      'venue_address', case when e.show_venue then e.venue_address else null end,
      'services', case when e.show_services then
          (select coalesce(jsonb_agg(s), '[]'::jsonb) from unnest(e.services) s) else null end,
      'booked_items', case when e.show_services then v_services else null end,
      'customer_notes', case when e.show_notes then e.customer_notes else null end,
      'next_step', e.next_step, 'next_step_due', e.next_step_due,
      'show_progress', e.show_progress,
      'show_payment', e.show_payment,
      'deposit_received', v_deposit_ok,
      'menu_confirmed', v_menu,
      'guest_count_confirmed', v_guests,
      'fully_paid', coalesce(f.payment_status, '') = 'paid_in_full'
    ),
    'payment', case when e.show_payment then jsonb_build_object(
        'total', f.total, 'paid', f.paid, 'balance', greatest(f.balance, 0),
        'due_date', e.payment_due_date) else null end,
    'appointments', v_appt,
    'expires_at', p.expires_at
  );
end $$;

revoke all on function public.get_portal(text) from public, anon, authenticated;
grant execute on function public.get_portal(text) to service_role;

-- Public business page ("/business/<slug>"): non-sensitive fields only.
create or replace function public.get_public_business(p_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select jsonb_build_object(
    'name', name, 'slug', slug, 'description', description, 'location', location,
    'phone', phone, 'whatsapp', whatsapp, 'logo_url', logo_url, 'cover_url', cover_url,
    'primary_color', primary_color, 'secondary_color', secondary_color, 'services', services,
    'business_type', business_type)
   from public.businesses where slug = p_slug), null);
$$;
revoke all on function public.get_public_business(text) from public, anon, authenticated;
grant execute on function public.get_public_business(text) to service_role;
