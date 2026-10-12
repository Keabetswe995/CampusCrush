-- =====================================================================
-- CampusCrush update 4 | Run AFTER schema.sql and update_1.sql through update_3.sql
-- Restricts profile/photo reads and changes photos to private signed URLs.
-- =====================================================================

do $$
begin
  if to_regclass('public.profile_private') is null then
    raise exception 'Cannot apply update_4.sql: public.profile_private is missing. Run update_3.sql successfully first, then retry update_4.sql.';
  end if;
  if to_regprocedure('public.km_between(double precision,double precision,double precision,double precision)') is null then
    raise exception 'Cannot apply update_4.sql: public.km_between is missing. Run update_1.sql successfully first, then retry update_4.sql.';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'gender_identity'
  ) then
    raise exception 'Cannot apply update_4.sql: profile preferences are missing. Run update_3.sql successfully first, then retry update_4.sql.';
  end if;
end $$;

create or replace function public.is_blocked(a uuid, b uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or a is null or b is null
     or (auth.uid() <> a and auth.uid() <> b) then
    raise exception 'You can only check blocks involving your own account.';
  end if;
  return exists (
    select 1 from public.blocks
    where (blocker = a and blocked = b) or (blocker = b and blocked = a)
  );
end $$;
revoke execute on function public.is_blocked(uuid, uuid) from public, anon;
grant execute on function public.is_blocked(uuid, uuid) to authenticated;

create or replace function public.can_view_profile(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    auth.uid() is not null
    and (
      target = auth.uid()
      or (
        not exists (
          select 1 from public.blocks b
          where (b.blocker = auth.uid() and b.blocked = target)
             or (b.blocker = target and b.blocked = auth.uid())
        )
        and (
          exists (
            select 1 from public.matches m
            where auth.uid() in (m.user_a, m.user_b)
              and target in (m.user_a, m.user_b)
          )
          or exists (
            select 1
            from public.profiles me
            join public.profile_private my_preferences on my_preferences.user_id = me.id
            join public.profiles candidate on candidate.id = target
            join public.profile_private their_preferences on their_preferences.user_id = candidate.id
            left join public.profile_locations my_location on my_location.user_id = me.id
            left join public.profile_locations their_location on their_location.user_id = candidate.id
            cross join lateral (
              select public.km_between(
                my_location.lat, my_location.lng, their_location.lat, their_location.lng
              ) as km
            ) distance
            where me.id = auth.uid()
              and not candidate.paused
              and candidate.gender_identity = any(my_preferences.interested_in)
              and me.gender_identity = any(their_preferences.interested_in)
              and extract(year from age(current_date, candidate.birth_date))
                  between my_preferences.min_age and my_preferences.max_age
              and extract(year from age(current_date, me.birth_date))
                  between their_preferences.min_age and their_preferences.max_age
              and (select count(*) from public.photos own_photo where own_photo.user_id = me.id) >= 5
              and (select count(*) from public.photos candidate_photo where candidate_photo.user_id = candidate.id) >= 5
              and not exists (
                select 1 from public.likes l
                where l.from_user = me.id and l.to_user = candidate.id
              )
              and not exists (
                select 1 from public.passes s
                where s.from_user = me.id and s.to_user = candidate.id
                  and s.created_at > now() - interval '7 days'
              )
              and (distance.km is null or (
                distance.km <= me.max_distance_km
                and distance.km <= candidate.max_distance_km
              ))
          )
        )
      )
    ),
    false
  );
$$;
revoke execute on function public.can_view_profile(uuid) from public, anon;
grant execute on function public.can_view_profile(uuid) to authenticated;

-- Replace every existing policy on these two tables to prevent older
-- permissive policies from broadening access through PostgreSQL's OR rules.
do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles', 'photos')
  loop
    execute format('drop policy %I on %I.%I',
      existing_policy.policyname, existing_policy.schemaname, existing_policy.tablename);
  end loop;
end $$;

create policy "profiles read authorized" on public.profiles
  for select to authenticated using (public.can_view_profile(id));
create policy "profiles insert own" on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy "profiles update own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "photos read authorized" on public.photos
  for select to authenticated using (public.can_view_profile(user_id));
create policy "photos insert own" on public.photos
  for insert to authenticated
  with check (user_id = auth.uid() and path like (auth.uid())::text || '/%');
create policy "photos delete own" on public.photos
  for delete to authenticated using (user_id = auth.uid());

update storage.buckets
set public = false,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'photos';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "photos bucket read" on storage.objects;
drop policy if exists "photos bucket read own folder" on storage.objects;
drop policy if exists "photos bucket read authorized" on storage.objects;
create policy "photos bucket read authorized" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'photos'
    and case
      when (storage.foldername(name))[1] ~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.can_view_profile(((storage.foldername(name))[1])::uuid)
      else false
    end
  );
