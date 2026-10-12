-- =====================================================================
-- CampusCrush update 1  |  Run ONCE in Supabase -> SQL Editor, AFTER schema.sql
-- Adds: pause profile, "Likes You", block list, delete account, "New here" badge
-- =====================================================================

alter table public.profiles add column if not exists paused boolean not null default false;

-- distance helper (km between two points)
create or replace function public.km_between(lat1 double precision, lng1 double precision,
                                              lat2 double precision, lng2 double precision)
returns double precision language sql immutable as $$
  select case when lat1 is null or lat2 is null or lng1 is null or lng2 is null then null else
    6371 * 2 * asin(least(1, sqrt(
      power(sin(radians(lat2 - lat1) / 2), 2) +
      cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
    )))
  end;
$$;

-- Discover: now skips paused profiles and returns created_at (for the "New here" badge)
drop function if exists public.discover_profiles(int);
create function public.discover_profiles(lim int default 20)
returns table (
  id uuid, name text, birth_date date, university text, city text,
  bio text, interests text[], created_at timestamptz, distance_km int
)
language sql stable security definer set search_path = public as $$
  with me as (
    select p.id, p.max_distance_km, l.lat, l.lng
    from profiles p left join profile_locations l on l.user_id = p.id
    where p.id = auth.uid()
  )
  select p.id, p.name, p.birth_date, p.university, p.city, p.bio, p.interests, p.created_at,
         case when d.km is null then null else round(d.km)::int end
  from profiles p
  cross join me
  left join profile_locations pl on pl.user_id = p.id
  cross join lateral (select public.km_between(me.lat, me.lng, pl.lat, pl.lng) as km) d
  where p.id <> me.id
    and not p.paused
    and exists (select 1 from photos ph where ph.user_id = p.id)
    and not exists (select 1 from likes l  where l.from_user = me.id and l.to_user = p.id)
    and not exists (select 1 from passes s where s.from_user = me.id and s.to_user = p.id
                    and s.created_at > now() - interval '7 days')
    and not exists (select 1 from blocks b where (b.blocker = me.id and b.blocked = p.id)
                                              or (b.blocker = p.id and b.blocked = me.id))
    and (d.km is null or d.km <= me.max_distance_km)
  order by random()
  limit least(greatest(lim, 1), 50);
$$;

-- Likes You: people who liked you and are waiting for your answer
create or replace function public.liked_me()
returns table (
  id uuid, name text, birth_date date, university text, city text,
  bio text, interests text[], created_at timestamptz, distance_km int
)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.birth_date, p.university, p.city, p.bio, p.interests, p.created_at,
         case when d.km is null then null else round(d.km)::int end
  from likes lk
  join profiles p on p.id = lk.from_user
  left join profile_locations ml on ml.user_id = auth.uid()
  left join profile_locations pl on pl.user_id = p.id
  cross join lateral (select public.km_between(ml.lat, ml.lng, pl.lat, pl.lng) as km) d
  where lk.to_user = auth.uid()
    and not exists (select 1 from likes x where x.from_user = auth.uid() and x.to_user = p.id)
    and not exists (select 1 from passes s where s.from_user = auth.uid() and s.to_user = p.id)
    and not exists (select 1 from blocks b where (b.blocker = auth.uid() and b.blocked = p.id)
                                              or (b.blocker = p.id and b.blocked = auth.uid()))
    and exists (select 1 from photos ph where ph.user_id = p.id)
  order by lk.created_at desc
  limit 100;
$$;

-- Block list (names of people you blocked, so you can unblock them)
create or replace function public.my_blocked_list()
returns table (id uuid, name text, blocked_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, b.created_at
  from blocks b join profiles p on p.id = b.blocked
  where b.blocker = auth.uid()
  order by b.created_at desc;
$$;

-- Delete my account and everything linked to it (profile, photos rows, likes, matches, chats)
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'Please sign in.'; end if;
  delete from auth.users where id = auth.uid();
end $$;

revoke execute on function public.discover_profiles(int), public.liked_me(),
  public.my_blocked_list(), public.delete_my_account() from public, anon;
grant execute on function public.discover_profiles(int), public.liked_me(),
  public.my_blocked_list(), public.delete_my_account() to authenticated;
