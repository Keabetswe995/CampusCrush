-- =====================================================================
-- CampusCrush update 3 | Run AFTER schema.sql, update_1.sql and update_2.sql
-- Adds mutual gender preferences, richer profiles, presence, one free boost,
-- a six-like daily limit, five-photo discovery, and private voice notes.
-- =====================================================================

-- ---------- PROFILE DETAILS AND PREFERENCES --------------------------

alter table public.profiles
  add column if not exists gender_identity text not null default 'prefer_not_to_say'
    check (gender_identity in ('woman', 'man', 'non_binary', 'prefer_not_to_say')),
  add column if not exists show_orientation boolean not null default false,
  add column if not exists height_cm smallint
    check (height_cm is null or height_cm between 120 and 230),
  add column if not exists dating_intention text not null default 'open_to_seeing'
    check (dating_intention in ('long_term', 'short_term', 'friendship', 'open_to_seeing')),
  add column if not exists music_preferences text[] not null default '{}'
    check (cardinality(music_preferences) <= 5),
  add column if not exists smoking text not null default 'Prefer not to say'
    check (smoking in ('Never', 'Sometimes', 'Regularly', 'Prefer not to say')),
  add column if not exists drinking text not null default 'Prefer not to say'
    check (drinking in ('Never', 'Sometimes', 'Socially', 'Regularly', 'Prefer not to say')),
  add column if not exists last_active_at timestamptz;

-- Orientation stays private unless a member explicitly chooses to display it.
create table if not exists public.profile_private (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  orientation text not null default 'prefer_not_to_say'
    check (orientation in ('straight', 'gay', 'lesbian', 'bisexual', 'pansexual', 'queer', 'questioning', 'prefer_not_to_say')),
  interested_in text[] not null
    default array['man', 'woman', 'non_binary', 'prefer_not_to_say']
    check (
      cardinality(interested_in) between 1 and 4
      and interested_in <@ array['woman', 'man', 'non_binary', 'prefer_not_to_say']::text[]
    ),
  min_age smallint not null default 18,
  max_age smallint not null default 99
);
alter table public.profile_private
  add column if not exists min_age smallint not null default 18,
  add column if not exists max_age smallint not null default 99;
alter table public.profile_private drop constraint if exists profile_private_age_range;
alter table public.profile_private add constraint profile_private_age_range
  check (min_age between 18 and 99 and max_age between min_age and 99);
alter table public.profile_private enable row level security;
drop policy if exists "profile private own read" on public.profile_private;
create policy "profile private own read" on public.profile_private
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "profile private own insert" on public.profile_private;
create policy "profile private own insert" on public.profile_private
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "profile private own update" on public.profile_private;
create policy "profile private own update" on public.profile_private
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'orientation'
  ) then
    execute $migration$
      insert into public.profile_private (user_id, orientation)
      select id, orientation from public.profiles
      on conflict (user_id) do nothing
    $migration$;
    alter table public.profiles drop column orientation;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'interested_in'
  ) then
    execute $migration$
      insert into public.profile_private (user_id, interested_in)
      select id, interested_in from public.profiles
      on conflict (user_id) do update set interested_in = excluded.interested_in
    $migration$;
    alter table public.profiles drop column interested_in;
  end if;
end $$;

insert into public.profile_private (user_id)
select id from public.profiles
on conflict (user_id) do nothing;

-- ---------- ACTIVE STATUS ---------------------------------------------

create or replace function public.touch_profile_presence()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Please sign in.'; end if;
  update public.profiles set last_active_at = now() where id = auth.uid();
end $$;

revoke execute on function public.touch_profile_presence() from public, anon;
grant execute on function public.touch_profile_presence() to authenticated;

-- ---------- ONE FREE PROFILE BOOST ------------------------------------

create table if not exists public.profile_boosts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  remaining smallint not null default 1 check (remaining between 0 and 1),
  active_until timestamptz
);
alter table public.profile_boosts enable row level security;
drop policy if exists "profile boosts own read" on public.profile_boosts;
create policy "profile boosts own read" on public.profile_boosts
  for select to authenticated using (user_id = auth.uid());

create or replace function public.grant_profile_boost()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profile_boosts (user_id, remaining) values (new.id, 1)
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists profiles_grant_boost on public.profiles;
create trigger profiles_grant_boost after insert on public.profiles
  for each row execute function public.grant_profile_boost();

-- Existing members also receive the one-time launch boost.
insert into public.profile_boosts (user_id, remaining)
select id, 1 from public.profiles
on conflict (user_id) do nothing;

create or replace function public.activate_profile_boost()
returns json language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  available smallint;
  current_until timestamptz;
  ends_at timestamptz;
begin
  if me is null then raise exception 'Please sign in.'; end if;
  if (select count(*) from public.photos where user_id = me) < 5 then
    raise exception 'Add at least 5 photos before boosting your profile.';
  end if;

  select remaining, active_until into available, current_until
  from public.profile_boosts where user_id = me for update;
  if not found then raise exception 'Your free boost is not available.'; end if;
  if current_until > now() then
    return json_build_object('remaining', available, 'active_until', current_until);
  end if;
  if available < 1 then raise exception 'Your free boost has already been used.'; end if;

  ends_at := now() + interval '30 minutes';
  update public.profile_boosts
    set remaining = available - 1, active_until = ends_at
    where user_id = me;
  return json_build_object('remaining', available - 1, 'active_until', ends_at);
end $$;

revoke execute on function public.activate_profile_boost() from public, anon;
grant execute on function public.activate_profile_boost() to authenticated;

-- ---------- SIX LIKES PER SOUTH-AFRICAN DAY ---------------------------

create or replace function public.likes_left()
returns int language sql stable security definer set search_path = public as $$
  select greatest(0, 6 - count(*))::int
  from public.likes
  where from_user = auth.uid()
    and (created_at at time zone 'Africa/Johannesburg')::date =
        (now() at time zone 'Africa/Johannesburg')::date;
$$;

create or replace function public.like_user(target uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  used int;
  mid uuid;
  matched boolean := false;
  a uuid; b uuid;
begin
  if me is null then raise exception 'Please sign in.'; end if;
  if me = target then raise exception 'You cannot like yourself.'; end if;
  if not exists (select 1 from public.profiles where id = me) then
    raise exception 'Finish your profile first.';
  end if;
  if (select count(*) from public.photos where user_id = me) < 5 then
    raise exception 'Add at least 5 photos before liking people.';
  end if;
  if public.is_blocked(me, target) or not exists (
    select 1
    from public.profiles mine
    join public.profiles candidate on candidate.id = target
    join public.profile_private mine_preferences on mine_preferences.user_id = mine.id
    join public.profile_private candidate_preferences on candidate_preferences.user_id = candidate.id
    left join public.profile_locations my_location on my_location.user_id = mine.id
    left join public.profile_locations their_location on their_location.user_id = candidate.id
    cross join lateral (
      select public.km_between(
        my_location.lat, my_location.lng, their_location.lat, their_location.lng
      ) as km
    ) distance
    where mine.id = me
      and not candidate.paused
      and candidate.gender_identity = any(mine_preferences.interested_in)
      and mine.gender_identity = any(candidate_preferences.interested_in)
      and extract(year from age(current_date, candidate.birth_date))
          between mine_preferences.min_age and mine_preferences.max_age
      and extract(year from age(current_date, mine.birth_date))
          between candidate_preferences.min_age and candidate_preferences.max_age
      and (select count(*) from public.photos ph where ph.user_id = candidate.id) >= 5
      and (distance.km is null or (distance.km <= mine.max_distance_km
                                   and distance.km <= candidate.max_distance_km))
  ) then
    raise exception 'This person is not available or does not match your preferences.';
  end if;

  -- Serialize likes from the same account so concurrent requests cannot exceed the daily cap.
  perform pg_advisory_xact_lock(hashtextextended(me::text, 0));

  select count(*) into used from public.likes
  where from_user = me
    and (created_at at time zone 'Africa/Johannesburg')::date =
        (now() at time zone 'Africa/Johannesburg')::date;

  if exists (select 1 from public.likes where from_user = me and to_user = target) then
    return json_build_object('matched', false, 'match_id', null, 'remaining', greatest(0, 6 - used));
  end if;
  if used >= 6 then raise exception 'DAILY_LIMIT'; end if;

  insert into public.likes (from_user, to_user) values (me, target);
  used := used + 1;

  if exists (select 1 from public.likes where from_user = target and to_user = me) then
    a := least(me, target); b := greatest(me, target);
    insert into public.matches (user_a, user_b) values (a, b) on conflict do nothing;
    select id into mid from public.matches where user_a = a and user_b = b;
    matched := true;
  end if;

  return json_build_object('matched', matched, 'match_id', mid, 'remaining', greatest(0, 6 - used));
end $$;

-- ---------- MUTUAL-PREFERENCE DISCOVERY -------------------------------

drop function if exists public.discover_profiles(int);
create function public.discover_profiles(lim int default 20)
returns table (
  id uuid, name text, birth_date date, university text, city text, bio text,
  interests text[], created_at timestamptz, distance_km int,
  gender_identity text, orientation text, show_orientation boolean, height_cm smallint,
  dating_intention text, music_preferences text[], smoking text, drinking text,
  active_now boolean
)
language sql stable security definer set search_path = public as $$
  with me as (
    select p.id, p.birth_date, p.gender_identity, preferences.interested_in,
           preferences.min_age, preferences.max_age, p.max_distance_km, l.lat, l.lng
    from public.profiles p
    left join public.profile_locations l on l.user_id = p.id
    join public.profile_private preferences on preferences.user_id = p.id
    where p.id = auth.uid()
      and (select count(*) from public.photos ph where ph.user_id = p.id) >= 5
  )
  select
    p.id, p.name, p.birth_date, p.university, p.city, p.bio, p.interests, p.created_at,
    case when d.km is null then null else round(d.km)::int end,
    p.gender_identity,
    case when p.show_orientation then privacy.orientation else null end,
    p.show_orientation, p.height_cm, p.dating_intention,
    p.music_preferences, p.smoking, p.drinking,
    coalesce(p.last_active_at > now() - interval '5 minutes', false)
  from public.profiles p
  cross join me
  left join public.profile_locations pl on pl.user_id = p.id
  left join public.profile_private privacy on privacy.user_id = p.id
  left join public.profile_boosts pb on pb.user_id = p.id
  cross join lateral (
    select public.km_between(me.lat, me.lng, pl.lat, pl.lng) as km
  ) d
  where p.id <> me.id
    and not p.paused
    and p.gender_identity = any(me.interested_in)
    and me.gender_identity = any(privacy.interested_in)
    and extract(year from age(current_date, p.birth_date)) between me.min_age and me.max_age
    and extract(year from age(current_date, me.birth_date)) between privacy.min_age and privacy.max_age
    and (select count(*) from public.photos ph where ph.user_id = p.id) >= 5
    and not exists (select 1 from public.likes l where l.from_user = me.id and l.to_user = p.id)
    and not exists (
      select 1 from public.passes s where s.from_user = me.id and s.to_user = p.id
        and s.created_at > now() - interval '7 days'
    )
    and not public.is_blocked(me.id, p.id)
    and (d.km is null or (d.km <= me.max_distance_km and d.km <= p.max_distance_km))
  order by coalesce(pb.active_until > now(), false) desc, random()
  limit least(greatest(lim, 1), 50);
$$;

drop function if exists public.liked_me();
create function public.liked_me()
returns table (
  id uuid, name text, birth_date date, university text, city text, bio text,
  interests text[], created_at timestamptz, distance_km int,
  gender_identity text, orientation text, show_orientation boolean, height_cm smallint,
  dating_intention text, music_preferences text[], smoking text, drinking text,
  active_now boolean
)
language sql stable security definer set search_path = public as $$
  with me as (
    select p.id, p.birth_date, p.gender_identity, preferences.interested_in,
           preferences.min_age, preferences.max_age, p.max_distance_km, l.lat, l.lng
    from public.profiles p
    left join public.profile_locations l on l.user_id = p.id
    join public.profile_private preferences on preferences.user_id = p.id
    where p.id = auth.uid()
      and (select count(*) from public.photos ph where ph.user_id = p.id) >= 5
  )
  select
    p.id, p.name, p.birth_date, p.university, p.city, p.bio, p.interests, p.created_at,
    case when d.km is null then null else round(d.km)::int end,
    p.gender_identity,
    case when p.show_orientation then privacy.orientation else null end,
    p.show_orientation, p.height_cm, p.dating_intention,
    p.music_preferences, p.smoking, p.drinking,
    coalesce(p.last_active_at > now() - interval '5 minutes', false)
  from public.likes lk
  join public.profiles p on p.id = lk.from_user
  cross join me
  left join public.profile_locations pl on pl.user_id = p.id
  left join public.profile_private privacy on privacy.user_id = p.id
  cross join lateral (
    select public.km_between(me.lat, me.lng, pl.lat, pl.lng) as km
  ) d
  where lk.to_user = me.id
    and not p.paused
    and p.gender_identity = any(me.interested_in)
    and me.gender_identity = any(privacy.interested_in)
    and extract(year from age(current_date, p.birth_date)) between me.min_age and me.max_age
    and extract(year from age(current_date, me.birth_date)) between privacy.min_age and privacy.max_age
    and (select count(*) from public.photos ph where ph.user_id = p.id) >= 5
    and not exists (select 1 from public.likes x where x.from_user = me.id and x.to_user = p.id)
    and not exists (select 1 from public.passes s where s.from_user = me.id and s.to_user = p.id)
    and not public.is_blocked(me.id, p.id)
    and (d.km is null or (d.km <= me.max_distance_km and d.km <= p.max_distance_km))
  order by lk.created_at desc
  limit 100;
$$;

revoke execute on function public.discover_profiles(int), public.liked_me() from public, anon;
grant execute on function public.discover_profiles(int), public.liked_me() to authenticated;

create or replace function public.matched_profiles()
returns table (
  id uuid, name text, birth_date date, university text, city text, bio text,
  interests text[], gender_identity text, orientation text, show_orientation boolean,
  height_cm smallint, dating_intention text, music_preferences text[], smoking text,
  drinking text, last_active_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select
    p.id, p.name, p.birth_date, p.university, p.city, p.bio, p.interests,
    p.gender_identity,
    case when p.show_orientation then privacy.orientation else null end,
    p.show_orientation, p.height_cm, p.dating_intention, p.music_preferences,
    p.smoking, p.drinking, p.last_active_at
  from public.matches m
  join public.profiles p on p.id = case when m.user_a = auth.uid() then m.user_b else m.user_a end
  left join public.profile_private privacy on privacy.user_id = p.id
  where auth.uid() in (m.user_a, m.user_b)
    and not public.is_blocked(auth.uid(), p.id);
$$;

revoke execute on function public.matched_profiles() from public, anon;
grant execute on function public.matched_profiles() to authenticated;

-- ---------- PRIVATE VOICE NOTES ---------------------------------------

alter table public.messages
  add column if not exists message_type text not null default 'text',
  add column if not exists audio_path text;

alter table public.messages drop constraint if exists messages_voice_shape;
alter table public.messages add constraint messages_voice_shape check (
  (message_type = 'text' and audio_path is null)
  or (message_type = 'voice' and audio_path is not null)
);

create or replace function public.enforce_message_media_path()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.message_type = 'voice'
    and new.audio_path not like new.match_id::text || '/' || new.sender_id::text || '/%' then
    raise exception 'Voice note path must belong to this match and sender.';
  end if;
  return new;
end $$;

drop trigger if exists messages_media_path on public.messages;
create trigger messages_media_path before insert or update on public.messages
  for each row execute function public.enforce_message_media_path();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'voice-notes', 'voice-notes', false, 10485760,
  array['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg', 'audio/wav', 'audio/aac']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "voice notes upload match member" on storage.objects;
create policy "voice notes upload match member" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'voice-notes'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and exists (
      select 1 from public.matches m
      where m.id::text = (storage.foldername(name))[1]
        and auth.uid() in (m.user_a, m.user_b)
    )
  );

drop policy if exists "voice notes read match member" on storage.objects;
create policy "voice notes read match member" on storage.objects
  for select to authenticated using (
    bucket_id = 'voice-notes'
    and exists (
      select 1 from public.matches m
      where m.id::text = (storage.foldername(name))[1]
        and auth.uid() in (m.user_a, m.user_b)
    )
  );

drop policy if exists "voice notes delete own match files" on storage.objects;
create policy "voice notes delete own match files" on storage.objects
  for delete to authenticated using (
    bucket_id = 'voice-notes'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and exists (
      select 1 from public.matches m
      where m.id::text = (storage.foldername(name))[1]
        and auth.uid() in (m.user_a, m.user_b)
    )
  );
