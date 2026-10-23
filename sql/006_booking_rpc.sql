-- ============================================================================
-- Atomic booking create/update. SECURITY INVOKER (the default), so Row Level
-- Security still applies to every statement: a user can only write into a
-- business they belong to. If anything fails (e.g. overpayment), everything rolls back.
-- ============================================================================

create or replace function public.create_booking(p jsonb)
returns uuid language plpgsql as $$
declare
  v_bid uuid := (p->>'business_id')::uuid;
  v_id uuid;
  it jsonb; i int := 0;
  lbl text;
begin
  insert into public.events (
    business_id, customer_id, name, event_type, event_date, start_time, end_time, venue, venue_address,
    guest_count, description, special_instructions, services, status,
    discount, additional_charges, delivery_fee, service_fee, deposit_required, payment_due_date
  ) values (
    v_bid, (p->>'customer_id')::uuid, p->>'name', coalesce(p->>'event_type', 'Other'), (p->>'event_date')::date,
    nullif(p->>'start_time', '')::time, nullif(p->>'end_time', '')::time, nullif(p->>'venue', ''), nullif(p->>'venue_address', ''),
    coalesce((p->>'guest_count')::int, 0), nullif(p->>'description', ''), nullif(p->>'special_instructions', ''),
    coalesce(array(select jsonb_array_elements_text(p->'services')), '{}'),
    coalesce(p->>'status', 'inquiry'),
    coalesce((p->>'discount')::numeric, 0), coalesce((p->>'additional_charges')::numeric, 0),
    coalesce((p->>'delivery_fee')::numeric, 0), coalesce((p->>'service_fee')::numeric, 0),
    coalesce((p->>'deposit_required')::numeric, 0), nullif(p->>'payment_due_date', '')::date
  ) returning id into v_id;

  for it in select * from jsonb_array_elements(coalesce(p->'items', '[]'::jsonb)) loop
    i := i + 1;
    insert into public.booking_items (business_id, event_id, service, description, quantity, unit_price, sort)
    values (v_bid, v_id, it->>'service', nullif(it->>'description', ''), (it->>'quantity')::numeric, (it->>'unit_price')::numeric, i);
  end loop;

  i := 0;
  foreach lbl in array array['Customer confirmed','Deposit received','Guest count confirmed','Menu confirmed','Venue confirmed',
      'Vendors confirmed','Ingredients purchased','Equipment arranged','Staff assigned','Final payment received','Event preparation complete'] loop
    i := i + 1;
    insert into public.checklist_items (business_id, event_id, label, sort) values (v_bid, v_id, lbl, i);
  end loop;

  if coalesce((p->'deposit'->>'amount')::numeric, 0) > 0 then
    insert into public.payments (business_id, event_id, amount, paid_on, method, reference, note)
    values (v_bid, v_id, (p->'deposit'->>'amount')::numeric, coalesce(nullif(p->'deposit'->>'paid_on', '')::date, current_date),
            coalesce(p->'deposit'->>'method', 'bank_transfer'), nullif(p->'deposit'->>'reference', ''), 'Deposit');
  end if;
  return v_id;
end $$;
grant execute on function public.create_booking(jsonb) to authenticated;
revoke execute on function public.create_booking(jsonb) from anon, public;

create or replace function public.update_booking(p_event_id uuid, p jsonb)
returns void language plpgsql as $$
declare
  v_bid uuid; it jsonb; i int := 0;
begin
  select business_id into v_bid from public.events where id = p_event_id;   -- RLS hides other businesses' rows
  if v_bid is null then raise exception 'NOT_FOUND'; end if;

  update public.events set
    customer_id = (p->>'customer_id')::uuid, name = p->>'name', event_type = coalesce(p->>'event_type', event_type),
    event_date = (p->>'event_date')::date, start_time = nullif(p->>'start_time', '')::time, end_time = nullif(p->>'end_time', '')::time,
    venue = nullif(p->>'venue', ''), venue_address = nullif(p->>'venue_address', ''),
    guest_count = coalesce((p->>'guest_count')::int, 0), description = nullif(p->>'description', ''),
    special_instructions = nullif(p->>'special_instructions', ''),
    services = coalesce(array(select jsonb_array_elements_text(p->'services')), '{}'),
    discount = coalesce((p->>'discount')::numeric, 0), additional_charges = coalesce((p->>'additional_charges')::numeric, 0),
    delivery_fee = coalesce((p->>'delivery_fee')::numeric, 0), service_fee = coalesce((p->>'service_fee')::numeric, 0),
    deposit_required = coalesce((p->>'deposit_required')::numeric, 0), payment_due_date = nullif(p->>'payment_due_date', '')::date
  where id = p_event_id;

  delete from public.booking_items where event_id = p_event_id;
  for it in select * from jsonb_array_elements(coalesce(p->'items', '[]'::jsonb)) loop
    i := i + 1;
    insert into public.booking_items (business_id, event_id, service, description, quantity, unit_price, sort)
    values (v_bid, p_event_id, it->>'service', nullif(it->>'description', ''), (it->>'quantity')::numeric, (it->>'unit_price')::numeric, i);
  end loop;
end $$;
grant execute on function public.update_booking(uuid, jsonb) to authenticated;
revoke execute on function public.update_booking(uuid, jsonb) from anon, public;

-- ---------- quotes (atomic, SECURITY INVOKER so RLS applies) -----------------
create or replace function public.create_quote(p jsonb)
returns uuid language plpgsql as $$
declare
  v_bid uuid := (p->>'business_id')::uuid; v_id uuid; it jsonb; i int := 0;
begin
  insert into public.quotes (business_id, event_id, customer_id, title, status, issue_date, expiry_date, discount, additional_charges, deposit_required, terms, notes)
  values (v_bid, nullif(p->>'event_id', '')::uuid, (p->>'customer_id')::uuid, p->>'title', 'draft',
          coalesce(nullif(p->>'issue_date', '')::date, current_date), nullif(p->>'expiry_date', '')::date,
          coalesce((p->>'discount')::numeric, 0), coalesce((p->>'additional_charges')::numeric, 0),
          coalesce((p->>'deposit_required')::numeric, 0), nullif(p->>'terms', ''), nullif(p->>'notes', ''))
  returning id into v_id;
  for it in select * from jsonb_array_elements(coalesce(p->'items', '[]'::jsonb)) loop
    i := i + 1;
    insert into public.quote_items (business_id, quote_id, service, description, quantity, unit_price, sort)
    values (v_bid, v_id, it->>'service', nullif(it->>'description', ''), (it->>'quantity')::numeric, (it->>'unit_price')::numeric, i);
  end loop;
  return v_id;
end $$;
grant execute on function public.create_quote(jsonb) to authenticated;
revoke execute on function public.create_quote(jsonb) from anon, public;

create or replace function public.update_quote(p_quote_id uuid, p jsonb)
returns void language plpgsql as $$
declare v_bid uuid; it jsonb; i int := 0;
begin
  select business_id into v_bid from public.quotes where id = p_quote_id;
  if v_bid is null then raise exception 'NOT_FOUND'; end if;
  update public.quotes set
    customer_id = (p->>'customer_id')::uuid, event_id = nullif(p->>'event_id', '')::uuid, title = p->>'title',
    expiry_date = nullif(p->>'expiry_date', '')::date, discount = coalesce((p->>'discount')::numeric, 0),
    additional_charges = coalesce((p->>'additional_charges')::numeric, 0), deposit_required = coalesce((p->>'deposit_required')::numeric, 0),
    terms = nullif(p->>'terms', ''), notes = nullif(p->>'notes', '')
  where id = p_quote_id;
  delete from public.quote_items where quote_id = p_quote_id;
  for it in select * from jsonb_array_elements(coalesce(p->'items', '[]'::jsonb)) loop
    i := i + 1;
    insert into public.quote_items (business_id, quote_id, service, description, quantity, unit_price, sort)
    values (v_bid, p_quote_id, it->>'service', nullif(it->>'description', ''), (it->>'quantity')::numeric, (it->>'unit_price')::numeric, i);
  end loop;
end $$;
grant execute on function public.update_quote(uuid, jsonb) to authenticated;
revoke execute on function public.update_quote(uuid, jsonb) from anon, public;
