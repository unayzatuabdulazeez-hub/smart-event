-- ============================================================================
-- Row Level Security. Default deny: RLS is enabled on every table; policies only
-- grant access to members of the row's business. The client can never widen this.
-- ============================================================================

-- profiles: own row only
alter table public.profiles enable row level security;
create policy profiles_select_own on public.profiles for select using (id = auth.uid());
create policy profiles_update_own on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- businesses: members read; owners update. No insert/delete from the client
-- (creation goes through create_business()).
alter table public.businesses enable row level security;
create policy businesses_select on public.businesses for select using (public.is_member(id));
create policy businesses_update on public.businesses for update
  using (public.has_role(id, array['owner']))
  with check (public.has_role(id, array['owner']));

-- business_members: members can see their own business's roster. Writes: none for v1.
alter table public.business_members enable row level security;
create policy members_select on public.business_members for select using (public.is_member(business_id));

-- Generic CRUD policies for business-owned tables ----------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'customers','events','booking_items','quotes','quote_items','vendors','event_vendors',
    'vendor_payments','event_expenses','tasks','checklist_items','appointments',
    'event_templates','catering_costings','small_chops_costings','follow_ups'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select using (public.is_member(business_id))', t || '_sel', t);
    execute format('create policy %I on public.%I for insert with check (public.is_member(business_id))', t || '_ins', t);
    execute format('create policy %I on public.%I for update using (public.is_member(business_id)) with check (public.is_member(business_id))', t || '_upd', t);
    execute format('create policy %I on public.%I for delete using (public.is_member(business_id))', t || '_del', t);
  end loop;
end $$;

-- payments: append-only history. Members may read and add. No update, no delete.
alter table public.payments enable row level security;
create policy payments_sel on public.payments for select using (public.is_member(business_id));
create policy payments_ins on public.payments for insert with check (public.is_member(business_id));

-- customer_portals: members manage links for their business. The raw token is
-- never in this table; token_hash is useless to anyone who reads it.
alter table public.customer_portals enable row level security;
create policy portals_sel on public.customer_portals for select using (public.is_member(business_id));
create policy portals_ins on public.customer_portals for insert with check (public.is_member(business_id));
create policy portals_upd on public.customer_portals for update
  using (public.is_member(business_id)) with check (public.is_member(business_id));
-- No delete: revoke instead, so history is kept.

-- portal_access: no policies at all => nobody but the service role can touch it.
alter table public.portal_access enable row level security;

-- Table privileges: anon gets nothing on business data.
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon;
grant select on public.event_financials to authenticated;
