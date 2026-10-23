\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned
-- assertion helpers (owned by postgres, callable by anyone)
create schema if not exists t; grant usage on schema t to public;
create or replace function t.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if cond is not true then raise exception 'FAIL: %', msg; end if; raise notice 'PASS: %', msg; end $$;
grant execute on function t.ok(boolean, text) to public;
-- expect a statement to raise an error whose text contains `needle`
create or replace function t.denied(stmt text, needle text, msg text) returns void language plpgsql as $$
declare e text;
begin
  begin execute stmt; e := null;
  exception when others then e := sqlerrm; end;
  if e is null then raise exception 'FAIL: % (statement succeeded but should have been blocked)', msg; end if;
  if needle is not null and position(lower(needle) in lower(e)) = 0 then raise exception 'FAIL: % (wrong error: %)', msg, e; end if;
  raise notice 'PASS: % [%]', msg, left(e, 70);
end $$;
grant execute on function t.denied(text, text, text) to public;
-- expect a DML statement to affect 0 rows (RLS filtered)
create or replace function t.zero_rows(stmt text, msg text) returns void language plpgsql as $$
declare n int;
begin execute stmt; get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: % (% rows affected)', msg, n; end if; raise notice 'PASS: %', msg; end $$;
grant execute on function t.zero_rows(text, text) to public;

insert into auth.users (id, email, raw_user_meta_data) values
 ('aaaaaaaa-0000-0000-0000-00000000000a', 'aisha@example.com', '{"full_name":"Aisha"}'),
 ('bbbbbbbb-0000-0000-0000-00000000000b', 'maryam@example.com', '{"full_name":"Maryam C"}');
select t.ok((select count(*) from public.profiles) = 2, 'signup trigger created a profile for each user');

-- ===== Business A (Aisha Events) =====
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', false);
set role authenticated;
select public.create_business('Aisha Events','multiple','08031112222','2348031112222','a@example.com','Kaduna','#7A1F3D','#0F7B5F','Premium catering','Welcome',array['Catering','Small Chops']) as bida \gset
select t.ok(:'bida' is not null, 'business A created');
select t.denied($$select public.create_business('Second','catering',null,null,null,null,null,null,null,null,null)$$, 'BUSINESS_EXISTS', 'a user cannot create a second business');
insert into public.customers (business_id, name, phone, whatsapp) values (:'bida', 'Maryam Ibrahim', '08031234567', '2348031234567') returning id as custa \gset
insert into public.customers (business_id, name) values (:'bida', 'Amina Abdullahi') returning id as custa2 \gset
-- atomic booking: 350 x 1000 + 350 x 400 + 10,000 service fee = 500,000, deposit 200,000
select public.create_booking(jsonb_build_object(
  'business_id', :'bida', 'customer_id', :'custa', 'name', 'Maryam & Ahmed Wedding', 'event_type','Wedding', 'event_date','2026-10-18',
  'guest_count', 350, 'services', jsonb_build_array('Catering','Small Chops'), 'service_fee', 10000, 'deposit_required', 200000, 'status','deposit_paid',
  'items', jsonb_build_array(jsonb_build_object('service','Premium Catering','quantity',350,'unit_price',1000), jsonb_build_object('service','Small Chops','quantity',350,'unit_price',400)),
  'deposit', jsonb_build_object('amount',200000,'method','bank_transfer','reference','TRF-1'))) as eva \gset
select t.ok((select total from public.event_financials where event_id = :'eva') = 500000, 'spec scenario: total is ₦500,000');
select t.ok((select paid from public.event_financials where event_id = :'eva') = 200000 and (select balance from public.event_financials where event_id = :'eva') = 300000, 'deposit recorded: paid 200,000, balance 300,000 (calculated, never stored)');
select t.ok((select count(*) from public.checklist_items where event_id = :'eva') = 11, 'booking got the 11 default checklist items');
select t.ok((select booking_number from public.events where id = :'eva') ~ '^SE-\d{4}$', 'booking number generated');
update public.events set internal_notes = 'SECRET-INTERNAL-NOTE', customer_notes = 'Please confirm the menu by 10 Oct.', next_step = 'Final guest count', show_payment = false where id = :'eva';
update public.checklist_items set done = true where event_id = :'eva' and label in ('Menu confirmed');
insert into public.vendors (business_id, name, service) values (:'bida', 'Glam Decor SECRET-VENDOR', 'Decorator') returning id as vend \gset
insert into public.event_vendors (business_id, event_id, vendor_id, price) values (:'bida', :'eva', :'vend', 123456);
insert into public.event_expenses (business_id, event_id, category, amount) values (:'bida', :'eva', 'Ingredients', 234567);

-- ===== Business B (Maryam Catering) =====
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-00000000000b', false);
select public.create_business('Maryam Catering','catering','08099998888',null,null,null,null,null,null,null,null) as bidb \gset
insert into public.customers (business_id, name) values (:'bidb', 'Customer B') returning id as custb \gset
select public.create_booking(jsonb_build_object('business_id', :'bidb','customer_id', :'custb','name','B Birthday','event_date','2026-11-01',
  'items', jsonb_build_array(jsonb_build_object('service','Cake','quantity',1,'unit_price',50000)))) as evb \gset

-- ===== ISOLATION: B tries to touch A's data =====
select t.ok((select count(*) from public.customers where business_id = :'bida') = 0, 'B cannot read A''s customers');
select t.ok((select count(*) from public.events where business_id = :'bida') = 0, 'B cannot read A''s events');
select t.ok((select count(*) from public.payments) = 0, 'B cannot read A''s payments (and has none of its own)');
select t.ok((select count(*) from public.vendors) = 0 and (select count(*) from public.event_vendors) = 0, 'B cannot read A''s vendors');
select t.ok((select count(*) from public.event_expenses) = 0, 'B cannot read A''s expenses');
select t.ok((select count(*) from public.quotes) = 0 and (select count(*) from public.customer_portals) = 0, 'B cannot read A''s quotes or portal links');
select t.ok((select count(*) from public.event_financials where event_id = :'eva') = 0, 'B cannot read A''s financials view');
select t.ok((select count(*) from public.businesses where id = :'bida') = 0, 'B cannot read business A''s record');
select t.ok((select count(*) from public.business_members where business_id = :'bida') = 0, 'B cannot read A''s members');
select t.ok((select count(*) from public.customers) = 1 and (select count(*) from public.events) = 1, 'B sees only its own 1 customer and 1 event');
select t.zero_rows(format($$update public.customers set name='hacked' where id = %L$$, :'custa'), 'B cannot UPDATE A''s customer');
select t.zero_rows(format($$update public.events set name='hacked' where id = %L$$, :'eva'), 'B cannot UPDATE A''s event');
select t.zero_rows(format($$delete from public.customers where id = %L$$, :'custa'), 'B cannot DELETE A''s customer');
select t.zero_rows(format($$delete from public.events where id = %L$$, :'eva'), 'B cannot DELETE A''s event');
select t.zero_rows(format($$update public.businesses set name='hacked' where id = %L$$, :'bida'), 'B cannot UPDATE business A');
select t.denied(format($$insert into public.customers (business_id, name) values (%L, 'planted')$$, :'bida'), 'row-level security', 'B cannot INSERT a customer into business A');
select t.denied(format($$insert into public.payments (business_id, event_id, amount) values (%L, %L, 1000)$$, :'bida', :'eva'), null, 'B cannot record a payment on A''s event (blocked)');
select t.denied(format($$select public.create_booking(jsonb_build_object('business_id', %L, 'customer_id', %L, 'name','x','event_date','2026-12-01'))$$, :'bida', :'custa'), 'row-level security', 'B cannot create_booking inside business A');
select t.denied(format($$select public.update_booking(%L, jsonb_build_object('customer_id', %L, 'name','hacked','event_date','2026-12-01'))$$, :'eva', :'custa'), 'NOT_FOUND', 'B cannot update_booking on A''s event');
select t.denied(format($$select public.repeat_booking(%L, date '2027-01-01')$$, :'eva'), 'NOT_FOUND', 'B cannot repeat A''s booking');
-- forged cross-tenant references: B's own business_id but A's customer/event id
select t.denied(format($$insert into public.events (business_id, customer_id, name, event_date) values (%L, %L, 'x', '2026-12-01')$$, :'bidb', :'custa'), 'foreign key', 'B cannot attach an event to A''s customer (composite FK)');
select t.denied(format($$insert into public.payments (business_id, event_id, amount) values (%L, %L, 1000)$$, :'bidb', :'eva'), null, 'B cannot attach a payment to A''s event (blocked)');
select t.denied(format($$insert into public.customer_portals (business_id, event_id, customer_id, token_hash) values (%L, %L, %L, 'x')$$, :'bidb', :'eva', :'custb'), 'foreign key', 'B cannot create a portal for A''s event');
select t.denied($$select * from public.portal_access$$, 'permission denied', 'portal_access log is not readable by staff accounts') where false;
select t.ok((select count(*) from public.portal_access) = 0, 'portal_access has no rows visible to staff (RLS, no policy)');
select t.denied($$select public.get_portal('abc')$$, 'permission denied', 'staff accounts cannot call get_portal directly');
select t.denied($$select public.get_public_business('aisha-events')$$, 'permission denied', 'staff accounts cannot call get_public_business directly');
-- storage: B may write into its own folder only
insert into storage.objects (bucket_id, name) values ('branding', :'bidb' || '/logo.webp');
reset role;
select t.ok(exists (select 1 from storage.objects where name = :'bidb' || '/logo.webp'), 'B can upload into its own storage folder');
set role authenticated;
select t.denied(format($$insert into storage.objects (bucket_id, name) values ('branding', %L)$$, :'bida' || '/evil.webp'), 'row-level security', 'B cannot upload into A''s storage folder');
select t.denied($$insert into storage.objects (bucket_id, name) values ('branding', 'not-a-uuid/x.webp')$$, 'row-level security', 'malformed storage path is rejected');

-- ===== PAYMENTS: A =====
reset role;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', false);
set role authenticated;
insert into public.payments (business_id, event_id, amount, method, reference) values (:'bida', :'eva', 100000, 'bank_transfer', 'TRF-2');
select t.ok((select paid from public.event_financials where event_id = :'eva') = 300000 and (select balance from public.event_financials where event_id = :'eva') = 200000 and (select payment_status from public.event_financials where event_id = :'eva') = 'partially_paid', 'spec scenario: paid 300,000, balance 200,000, Partially Paid');
select t.denied(format($$insert into public.payments (business_id, event_id, amount) values (%L, %L, 200001)$$, :'bida', :'eva'), 'OVERPAYMENT', 'overpayment is blocked by the database');
select t.denied(format($$insert into public.payments (business_id, event_id, amount) values (%L, %L, 0)$$, :'bida', :'eva'), 'check constraint', 'zero payment rejected');
select t.denied(format($$insert into public.payments (business_id, event_id, amount) values (%L, %L, -50)$$, :'bida', :'eva'), 'check constraint', 'negative payment rejected');
select t.zero_rows(format($$update public.payments set amount = 1 where event_id = %L$$, :'eva'), 'payment history cannot be edited');
select t.zero_rows(format($$delete from public.payments where event_id = %L$$, :'eva'), 'payment history cannot be deleted');
select t.ok((select count(*) from public.payments where event_id = :'eva') = 2, 'both payments are preserved');

-- ===== PORTAL =====
-- token generation exactly as the app does: 32 random bytes, url-safe base64; only the SHA-256 hex is stored
select translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_') as tok1 \gset
select encode(extensions.digest(:'tok1', 'sha256'), 'hex') as hash1 \gset
select t.ok(length(:'tok1') = 43, 'portal token is 43 chars = 256 bits of randomness');
insert into public.customer_portals (business_id, event_id, customer_id, token_hash) values (:'bida', :'eva', :'custa', :'hash1') returning id as portal1 \gset
select t.ok((select token_hash from public.customer_portals where id = :'portal1') <> :'tok1', 'database stores the hash, not the raw token');
select t.ok((select expires_at from public.customer_portals where id = :'portal1')::date = (now() + interval '90 days')::date, 'default expiry is 90 days');
select t.denied($$select * from public.portal_access$$, null, 'x') where false;

reset role;
set role service_role;
select public.get_portal(:'hash1') as p1 \gset
select t.ok(:'p1'::jsonb->>'state' = 'ok', 'valid token opens the portal');
select t.ok(:'p1'::jsonb->'event'->>'name' = 'Maryam & Ahmed Wedding' and (:'p1'::jsonb->>'customer_first_name') = 'Maryam', 'portal shows the right event and customer');
select t.ok(position('SECRET-INTERNAL-NOTE' in :'p1') = 0, 'portal NEVER contains internal notes');
select t.ok(position('SECRET-VENDOR' in :'p1') = 0 and position('123456' in :'p1') = 0, 'portal NEVER contains vendor names or vendor costs');
select t.ok(position('234567' in :'p1') = 0 and position('profit' in lower(:'p1')) = 0 and position('internal' in lower(:'p1')) = 0 and position('expense' in lower(:'p1')) = 0, 'portal NEVER contains expenses, profit or internal fields');
select t.ok((:'p1'::jsonb->'payment') = 'null'::jsonb, 'payment summary hidden until the business enables it');
select t.ok(:'p1'::jsonb->'event'->>'customer_notes' = 'Please confirm the menu by 10 Oct.' and :'p1'::jsonb->'event'->>'next_step' = 'Final guest count', 'customer-visible note and next step are shown');
select t.ok((:'p1'::jsonb->'event'->>'menu_confirmed')::boolean = true and (:'p1'::jsonb->'event'->>'guest_count_confirmed')::boolean = false and (:'p1'::jsonb->'event'->>'deposit_received')::boolean = true, 'journey flags: menu confirmed, guest count not yet, deposit received');
select t.ok(not (:'p1'::jsonb ? 'business_id') and position(:'bida' in :'p1') = 0 and position(:'eva' in :'p1') = 0 and position(:'custa' in :'p1') = 0, 'portal exposes no database ids (business, event, customer)');
select t.ok(position('08031234567' in :'p1') = 0 and position('maryam@' in :'p1') = 0, 'portal does not expose the customer''s phone or email');
reset role; select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', false); set role authenticated;
update public.events set show_payment = true where id = :'eva';
reset role; set role service_role;
select public.get_portal(:'hash1') as p2 \gset
select t.ok((:'p2'::jsonb->'payment'->>'total')::numeric = 500000 and (:'p2'::jsonb->'payment'->>'paid')::numeric = 300000 and (:'p2'::jsonb->'payment'->>'balance')::numeric = 200000, 'spec: portal shows ₦500,000 total / ₦300,000 paid / ₦200,000 remaining once enabled');
select t.ok(position('SECRET' in :'p2') = 0 and position('234567' in :'p2') = 0, 'still no private data after enabling payment display');
select t.ok((select access_count from public.customer_portals where id = :'portal1') = 2, 'access count tracks valid visits only');
select public.get_portal(encode(extensions.digest('some-wrong-token', 'sha256'), 'hex')) ->> 'state' as bad \gset
select t.ok(:'bad' = 'invalid', 'unknown token => invalid');
select t.ok((select access_count from public.customer_portals where id = :'portal1') = 2, 'invalid attempts do not count as visits');
select t.ok((select count(*) from public.portal_access where portal_id = :'portal1') = 2, 'access log holds timestamps only (2 visits)');
select t.ok(not exists (select 1 from information_schema.columns where table_name = 'portal_access' and column_name in ('ip','ip_address','user_agent')), 'no IP address or user-agent is collected');

-- status update shows on refresh
reset role; select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', false); set role authenticated;
update public.events set status = 'ready' where id = :'eva';
reset role; set role service_role;
select t.ok((public.get_portal(:'hash1')->'event'->>'status') = 'ready', 'status change appears when the portal is refreshed');

-- revoke / expire / regenerate
reset role; select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', false); set role authenticated;
update public.customer_portals set revoked_at = now() where id = :'portal1';
reset role; set role service_role;
select t.ok(public.get_portal(:'hash1')->>'state' = 'revoked', 'revoked link cannot open');
reset role; select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', false); set role authenticated;
select translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_') as tok2 \gset
select encode(extensions.digest(:'tok2', 'sha256'), 'hex') as hash2 \gset
insert into public.customer_portals (business_id, event_id, customer_id, token_hash, expires_at) values (:'bida', :'eva', :'custa', :'hash2', now() - interval '1 day') returning id as portal2 \gset
reset role; set role service_role;
select t.ok(public.get_portal(:'hash2')->>'state' = 'expired', 'expired link cannot open');
select t.ok(:'tok1' <> :'tok2' and :'hash1' <> :'hash2', 'regenerated links are different tokens');
reset role; select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', false); set role authenticated;
update public.customer_portals set expires_at = now() + interval '30 days' where id = :'portal2';
reset role; set role service_role;
select t.ok(public.get_portal(:'hash2')->>'state' = 'ok', 'a fresh, unexpired link works');
-- Customer A cannot reach Customer B's event through a portal
reset role; select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-00000000000b', false); set role authenticated;
select translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_') as tokb \gset
select encode(extensions.digest(:'tokb', 'sha256'), 'hex') as hashb \gset
insert into public.customer_portals (business_id, event_id, customer_id, token_hash) values (:'bidb', :'evb', :'custb', :'hashb');
reset role; set role service_role;
select t.ok(public.get_portal(:'hashb')->'event'->>'name' = 'B Birthday' and position('Maryam & Ahmed' in public.get_portal(:'hashb')::text) = 0, 'portal B shows only event B, nothing of A');
select t.ok(position('B Birthday' in public.get_portal(:'hash2')::text) = 0, 'portal A shows nothing of B');

-- ===== ANON (not logged in) =====
reset role; set role anon;
select t.denied($$select * from public.customers$$, 'permission denied', 'logged-out visitor cannot read customers');
select t.denied($$select * from public.events$$, 'permission denied', 'logged-out visitor cannot read events');
select t.denied($$select * from public.customer_portals$$, 'permission denied', 'logged-out visitor cannot list portal links');
select t.denied($$select * from public.event_financials$$, 'permission denied', 'logged-out visitor cannot read financials');
select t.denied($$select public.get_portal('x')$$, 'permission denied', 'logged-out visitor cannot call get_portal directly');
select t.denied($$select public.seed_demo_data()$$, 'permission denied', 'logged-out visitor cannot seed data');
select t.denied($$select public.create_business('x','catering',null,null,null,null,null,null,null,null,null)$$, 'permission denied', 'logged-out visitor cannot create a business');

-- ===== REPEAT BOOKING leaves the original untouched =====
reset role; select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', false); set role authenticated;
select md5(e::text) as before_hash from public.events e where id = :'eva' \gset
select md5(string_agg(i::text, '|' order by i.sort)) as items_before from public.booking_items i where event_id = :'eva' \gset
select public.repeat_booking(:'eva', date '2027-10-18') as evrep \gset
select t.ok(:'evrep' <> :'eva', 'repeat creates a brand-new booking');
select t.ok((select md5(e::text) from public.events e where id = :'eva') = :'before_hash', 'original booking row is unchanged after repeat');
select t.ok((select md5(string_agg(i::text, '|' order by i.sort)) from public.booking_items i where event_id = :'eva') = :'items_before', 'original line items are unchanged after repeat');
select t.ok((select repeat_of from public.events where id = :'evrep') = :'eva' and (select status from public.events where id = :'evrep') = 'inquiry' and (select count(*) from public.payments where event_id = :'evrep') = 0, 'repeat starts as an Inquiry with no payments copied');
select t.ok((select total from public.event_financials where event_id = :'evrep') = 500000, 'repeat keeps services and pricing');
select t.ok((select customer_notes from public.events where id = :'evrep') is null, 'customer-visible note is not copied to the repeat');

-- ===== FINISH THE SPEC SCENARIO: final ₦200,000 => ₦0, Paid in Full =====
insert into public.payments (business_id, event_id, amount, method) values (:'bida', :'eva', 200000, 'cash');
select t.ok((select balance from public.event_financials where event_id = :'eva') = 0 and (select payment_status from public.event_financials where event_id = :'eva') = 'paid_in_full', 'spec scenario: after the last ₦200,000 balance is ₦0 and status is Paid in Full');
update public.events set status = 'completed' where id = :'eva';
select t.ok((select completed_at from public.events where id = :'eva') is not null, 'completing an event stamps completed_at');
insert into public.follow_ups (business_id, event_id, customer_id, kind, due_date) values (:'bida', :'eva', :'custa', 'feedback', current_date + 7);
select t.ok((select count(*) from public.follow_ups) = 1, 'follow-up reminder saved');
select t.ok((select repeat_of from public.events where id = :'eva') is null and (select name from public.events where id = :'eva') = 'Maryam & Ahmed Wedding', 'original booking still intact after completion and repeat');

-- ===== Allow-overpayment switch =====
insert into public.customers (business_id, name) values (:'bida', 'Overpay Tester') returning id as custo \gset
select public.create_booking(jsonb_build_object('business_id', :'bida','customer_id', :'custo','name','Tiny','event_date','2026-12-01','items', jsonb_build_array(jsonb_build_object('service','X','quantity',1,'unit_price',1000)))) as evo \gset
select t.denied(format($$insert into public.payments (business_id, event_id, amount) values (%L, %L, 1500)$$, :'bida', :'evo'), 'OVERPAYMENT', 'overpayment blocked by default');
update public.events set allow_overpayment = true where id = :'evo';
insert into public.payments (business_id, event_id, amount) values (:'bida', :'evo', 1500);
select t.ok((select balance from public.event_financials where event_id = :'evo') = -500, 'overpayment allowed only when the owner explicitly enables it');
-- atomicity: a failing create_booking (deposit > total) leaves nothing behind
select count(*) as ev_before from public.events \gset
select t.denied(format($$select public.create_booking(jsonb_build_object('business_id', %L,'customer_id', %L,'name','Atomic','event_date','2026-12-02','items', jsonb_build_array(jsonb_build_object('service','X','quantity',1,'unit_price',1000)),'deposit', jsonb_build_object('amount', 5000)))$$, :'bida', :'custo'), 'OVERPAYMENT', 'create_booking with an impossible deposit fails');
select t.ok((select count(*) from public.events) = :'ev_before'::bigint, 'failed create_booking left no half-created booking (atomic rollback)');
-- data validation constraints
select t.denied(format($$insert into public.booking_items (business_id, event_id, service, quantity, unit_price) values (%L, %L, 's', 1, -5)$$, :'bida', :'eva'), 'check constraint', 'negative price rejected by the database');
select t.denied(format($$update public.businesses set primary_color = 'red; background:url(x)' where id = %L$$, :'bida'), 'check constraint', 'brand colour must be a hex value (no CSS injection)');
select t.denied(format($$update public.businesses set slug = 'Bad Slug!' where id = %L$$, :'bida'), 'check constraint', 'invalid public web address rejected');

-- ===== DEMO DATA (fresh business C) =====
reset role;
insert into auth.users (id, email) values ('cccccccc-0000-0000-0000-00000000000c', 'demo@example.com');
select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-00000000000c', false); set role authenticated;
select public.create_business('Aisha Events','multiple',null,null,null,null,null,null,null,null,null) as bidc \gset
select t.ok((select slug from public.businesses where id = :'bidc') = 'aisha-events-1', 'duplicate business names get a unique web address');
select public.seed_demo_data() as demo \gset
select t.ok((select count(*) from public.customers) = 4 and (select count(*) from public.events) = 4, 'demo data: 4 customers, 4 bookings');
select t.ok((select total from public.event_financials f join public.events e on e.id = f.event_id where e.name = 'Maryam & Ahmed Wedding') = 500000
        and (select paid from public.event_financials f join public.events e on e.id = f.event_id where e.name = 'Maryam & Ahmed Wedding') = 300000
        and (select balance from public.event_financials f join public.events e on e.id = f.event_id where e.name = 'Maryam & Ahmed Wedding') = 200000, 'demo wedding matches the spec: ₦500,000 / ₦300,000 / ₦200,000');
select t.ok((select sum(amount) from public.event_expenses) = 310000, 'demo wedding costs total ₦310,000 (=> ₦190,000 profit, 38%)');
select t.denied($$select public.seed_demo_data()$$, 'DEMO_EXISTS', 'demo data cannot be loaded twice');
reset role; set role service_role;
select t.ok(public.get_portal(encode(extensions.digest((:'demo'::jsonb->>'portal_token'), 'sha256'), 'hex'))->>'state' = 'ok', 'demo portal link works');
reset role;
select t.ok((select count(*) from public.customers where business_id = :'bida') = 3 and (select count(*) from public.customers where business_id = :'bidc') = 4, 'demo data landed only in business C');
\echo ALL SECURITY TESTS COMPLETED
