-- ============================================================================
-- Demo data loader. Called from the app ("Load demo data") for the caller's own
-- business only. Creates realistic Aisha Events style data and ONE portal link.
-- Returns the raw portal token once (it is not stored anywhere).
-- ============================================================================
create or replace function public.seed_demo_data()
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid uuid := auth.uid();
  v_bid uuid;
  c_maryam uuid; c_amina uuid; c_fatima uuid; c_zainab uuid;
  e_wed uuid; e_bday uuid; e_name uuid; e_corp uuid;
  v_dec uuid; v_photo uuid; v_dj uuid; v_ev uuid;
  q1 uuid;
  v_token text; v_hash text;
begin
  select business_id into v_bid from business_members where user_id = v_uid limit 1;
  if v_bid is null then raise exception 'NO_BUSINESS'; end if;
  if exists (select 1 from customers where business_id = v_bid and name = 'Maryam Ibrahim') then
    raise exception 'DEMO_EXISTS';
  end if;

  insert into customers (business_id, name, phone, whatsapp, email, address, preferred_contact, notes)
    values (v_bid, 'Maryam Ibrahim', '08031234567', '2348031234567', 'maryam@example.com', 'Kaduna', 'whatsapp', 'Prefers WhatsApp. Do not call after 9pm.') returning id into c_maryam;
  insert into customers (business_id, name, phone, whatsapp, preferred_contact)
    values (v_bid, 'Amina Abdullahi', '08059876543', '2348059876543', 'whatsapp') returning id into c_amina;
  insert into customers (business_id, name, phone, whatsapp, email, preferred_contact)
    values (v_bid, 'Fatima Bello', '07012345678', '2347012345678', 'fatima.bello@example.com', 'phone') returning id into c_fatima;
  insert into customers (business_id, name, phone, whatsapp, preferred_contact, notes)
    values (v_bid, 'Zainab Musa', '09022334455', '2349022334455', 'email', 'Corporate contact, works at a logistics firm.') returning id into c_zainab;

  -- Wedding: total 500,000 (350k catering + 140k small chops + 10k service fee), paid 300,000
  insert into events (business_id, customer_id, name, event_type, event_date, start_time, end_time, venue, venue_address,
      guest_count, services, status, service_fee, deposit_required, payment_due_date, internal_notes, customer_notes,
      next_step, next_step_due, show_payment)
    values (v_bid, c_maryam, 'Maryam & Ahmed Wedding', 'Wedding', date '2026-10-18', '12:00', '18:00',
      'Murtala Square Event Hall', 'Kaduna', 350, array['Catering','Small Chops'], 'final_details', 10000, 200000, date '2026-10-14',
      'Customer changed guest count twice. Vendor decorator asked for payment before Friday.',
      'Final menu confirmation is required before 10 October.', 'Final guest count', date '2026-10-10', true)
    returning id into e_wed;
  insert into booking_items (business_id, event_id, service, description, quantity, unit_price, sort) values
    (v_bid, e_wed, 'Premium Wedding Catering', 'Jollof, fried rice, protein, salads, drinks', 350, 1000, 1),
    (v_bid, e_wed, 'Small Chops Package', 'Spring rolls, samosa, puff-puff, chicken', 350, 400, 2);
  insert into payments (business_id, event_id, amount, paid_on, method, reference, note) values
    (v_bid, e_wed, 200000, current_date - 14, 'bank_transfer', 'TRF-88213', 'Deposit'),
    (v_bid, e_wed, 100000, current_date - 3, 'bank_transfer', 'TRF-90412', 'Second instalment');

  -- Birthday
  insert into events (business_id, customer_id, name, event_type, event_date, start_time, venue, guest_count, services, status,
      deposit_required, payment_due_date, customer_notes)
    values (v_bid, c_amina, 'Amina''s 30th Birthday', 'Birthday', current_date + 6, '16:00', 'Rooftop Lounge, Kaduna', 80,
      array['Small Chops','Dessert'], 'deposit_paid', 60000, current_date + 3, 'Please confirm cake flavour.') returning id into e_bday;
  insert into booking_items (business_id, event_id, service, quantity, unit_price, sort) values
    (v_bid, e_bday, 'Small Chops Package', 80, 1500, 1), (v_bid, e_bday, 'Dessert Table', 1, 80000, 2);
  insert into payments (business_id, event_id, amount, method, reference) values (v_bid, e_bday, 60000, 'cash', null);

  -- Naming ceremony (completed, fully paid)
  insert into events (business_id, customer_id, name, event_type, event_date, venue, guest_count, services, status)
    values (v_bid, c_fatima, 'Bello Naming Ceremony', 'Naming Ceremony', current_date - 20, 'Family compound', 120,
      array['Catering'], 'completed') returning id into e_name;
  insert into booking_items (business_id, event_id, service, quantity, unit_price, sort) values
    (v_bid, e_name, 'Naming Ceremony Catering', 120, 2500, 1);
  insert into payments (business_id, event_id, amount, method) values
    (v_bid, e_name, 150000, 'bank_transfer'), (v_bid, e_name, 150000, 'pos');

  -- Corporate (awaiting approval, nothing paid)
  insert into events (business_id, customer_id, name, event_type, event_date, venue, guest_count, services, status,
      deposit_required, payment_due_date)
    values (v_bid, c_zainab, 'Year-End Staff Dinner', 'Corporate Event', current_date + 25, 'Hotel Ballroom', 200,
      array['Catering','Event Planning','Decoration'], 'awaiting_approval', 400000, current_date + 9) returning id into e_corp;
  insert into booking_items (business_id, event_id, service, quantity, unit_price, sort) values
    (v_bid, e_corp, 'Dinner Catering', 200, 4000, 1), (v_bid, e_corp, 'Decoration', 1, 250000, 2),
    (v_bid, e_corp, 'Event Planning', 1, 150000, 3);

  -- Vendors (private)
  insert into vendors (business_id, name, service, phone, whatsapp) values (v_bid, 'Glam Decor Kaduna', 'Decorator', '08011110000', '2348011110000') returning id into v_dec;
  insert into vendors (business_id, name, service, phone, whatsapp) values (v_bid, 'Snapshot Studios', 'Photographer', '08022220000', '2348022220000') returning id into v_photo;
  insert into vendors (business_id, name, service, phone, whatsapp) values (v_bid, 'DJ Zaria', 'DJ', '08033330000', '2348033330000') returning id into v_dj;
  insert into event_vendors (business_id, event_id, vendor_id, price, status, due_date) values (v_bid, e_wed, v_dec, 120000, 'deposit_paid', current_date + 1) returning id into v_ev;
  insert into vendor_payments (business_id, event_vendor_id, amount, note) values (v_bid, v_ev, 60000, 'Deposit');
  insert into event_vendors (business_id, event_id, vendor_id, price, status) values (v_bid, e_wed, v_photo, 80000, 'confirmed');
  insert into event_vendors (business_id, event_id, vendor_id, price, status) values (v_bid, e_wed, v_dj, 50000, 'contacted');

  -- Expenses (private): total 310,000 against 500,000 revenue => 190,000 profit (38%)
  insert into event_expenses (business_id, event_id, category, description, amount) values
    (v_bid, e_wed, 'Ingredients', 'Rice, chicken, oil, spices', 180000),
    (v_bid, e_wed, 'Labour', 'Cooks and waiters', 60000),
    (v_bid, e_wed, 'Packaging', 'Small-chops boxes', 25000),
    (v_bid, e_wed, 'Transport', 'Delivery vehicles', 20000),
    (v_bid, e_wed, 'Fuel/Gas', 'Gas refill', 25000);

  -- Tasks & checklist
  insert into tasks (business_id, event_id, title, due_date, priority, status) values
    (v_bid, e_wed, 'Get final guest count from Maryam', date '2026-10-10', 'high', 'todo'),
    (v_bid, e_wed, 'Pay decorator balance', current_date + 1, 'high', 'todo'),
    (v_bid, e_wed, 'Buy ingredients', date '2026-10-15', 'normal', 'in_progress'),
    (v_bid, e_bday, 'Confirm cake flavour', current_date + 2, 'normal', 'todo');
  insert into checklist_items (business_id, event_id, label, done, sort) values
    (v_bid, e_wed, 'Customer confirmed', true, 1), (v_bid, e_wed, 'Deposit received', true, 2),
    (v_bid, e_wed, 'Menu confirmed', true, 3), (v_bid, e_wed, 'Guest count confirmed', false, 4),
    (v_bid, e_wed, 'Venue confirmed', true, 5), (v_bid, e_wed, 'Vendors confirmed', false, 6),
    (v_bid, e_wed, 'Ingredients purchased', false, 7), (v_bid, e_wed, 'Staff assigned', false, 8),
    (v_bid, e_wed, 'Final payment received', false, 9);
  insert into appointments (business_id, event_id, title, starts_at, location, customer_visible) values
    (v_bid, e_wed, 'Final tasting with Maryam', now() + interval '3 days', 'Aisha Events kitchen', true);

  -- Quote
  insert into quotes (business_id, event_id, customer_id, title, status, expiry_date, deposit_required, terms)
    values (v_bid, e_corp, c_zainab, 'Year-End Staff Dinner', 'sent', current_date + 14, 400000,
      '50% deposit confirms the booking. Balance due 3 days before the event. Quote valid until the expiry date.')
    returning id into q1;
  insert into quote_items (business_id, quote_id, service, quantity, unit_price, sort) values
    (v_bid, q1, 'Dinner Catering', 200, 4000, 1), (v_bid, q1, 'Decoration', 1, 250000, 2), (v_bid, q1, 'Event Planning', 1, 150000, 3);

  insert into follow_ups (business_id, event_id, customer_id, kind, due_date)
    values (v_bid, e_name, c_fatima, 'feedback', current_date + 1);

  -- Portal link for the wedding (raw token returned once)
  v_token := translate(encode(gen_random_bytes(32), 'base64'), '+/=', '-_');
  v_hash := encode(digest(v_token, 'sha256'), 'hex');
  insert into customer_portals (business_id, event_id, customer_id, token_hash) values (v_bid, e_wed, c_maryam, v_hash);

  return jsonb_build_object('portal_token', v_token, 'event_id', e_wed);
end $$;
revoke all on function public.seed_demo_data() from public, anon;
grant execute on function public.seed_demo_data() to authenticated;
