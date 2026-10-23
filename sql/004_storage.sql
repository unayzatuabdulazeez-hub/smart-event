-- ============================================================================
-- Storage. Two public-read buckets (images are shown on branded customer pages).
-- File names are random UUIDs, so URLs are unguessable. Writes are restricted to
-- members of the business whose id is the first folder of the object path:
--   <business_id>/<random>.jpg
-- Do not upload private documents here.
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('branding', 'branding', true, 3145728, array['image/jpeg','image/png','image/webp']),
  ('event-images', 'event-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.storage_business_id(p_name text)
returns uuid language plpgsql immutable as $$
begin
  return ((string_to_array(p_name, '/'))[1])::uuid;
exception when others then
  return null;
end $$;

do $$
declare b text;
begin
  foreach b in array array['branding','event-images'] loop
    execute format($f$create policy %I on storage.objects for insert to authenticated
      with check (bucket_id = %L and public.is_member(public.storage_business_id(name)))$f$, b || '_ins', b);
    execute format($f$create policy %I on storage.objects for update to authenticated
      using (bucket_id = %L and public.is_member(public.storage_business_id(name)))
      with check (bucket_id = %L and public.is_member(public.storage_business_id(name)))$f$, b || '_upd', b, b);
    execute format($f$create policy %I on storage.objects for delete to authenticated
      using (bucket_id = %L and public.is_member(public.storage_business_id(name)))$f$, b || '_del', b);
  end loop;
end $$;
-- Reads: buckets are public, so no select policy is needed for public URLs.
