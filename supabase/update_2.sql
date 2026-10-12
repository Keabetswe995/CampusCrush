-- =====================================================================
-- CampusCrush update 2 | Run in Supabase -> SQL Editor for existing projects
-- Repairs photo upload policies and configures private photo storage.
-- =====================================================================

update storage.buckets
set public = false,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'photos';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "photos bucket upload own folder" on storage.objects;
create policy "photos bucket upload own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "photos bucket delete own folder" on storage.objects;
create policy "photos bucket delete own folder" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "photos bucket read" on storage.objects;
drop policy if exists "photos bucket read own folder" on storage.objects;
create policy "photos bucket read own folder" on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "photos insert" on public.photos;
create policy "photos insert" on public.photos
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "photos delete" on public.photos;
create policy "photos delete" on public.photos
  for delete to authenticated
  using (user_id = (select auth.uid()));
