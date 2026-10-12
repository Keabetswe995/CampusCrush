-- =====================================================================
-- CampusCrush database  |  Paste this whole file into
-- Supabase Dashboard -> SQL Editor -> New query -> Run
-- Safe to run once on a fresh project.
-- =====================================================================

-- ---------- TABLES ----------------------------------------------------

create table public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  name           text not null check (char_length(trim(name)) between 2 and 40),
  birth_date     date not null,
  university     text not null check (char_length(trim(university)) between 2 and 80),
  city           text not null check (char_length(trim(city)) between 2 and 60),
  bio            text not null default '' check (char_length(bio) <= 300),
  interests      text[] not null default '{}' check (cardinality(interests) <= 8),
  max_distance_km int not null default 50 check (max_distance_km between 1 and 2000),
  created_at     timestamptz not null default now()
);

-- Exact coordinates live in their own table that only the owner can read.
-- Other people only ever see a rounded "X km away" produced by discover_profiles().
create table public.profile_locations (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180)
);

create table public.photos (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  path       text not null,
  position   int not null default 0,
  created_at timestamptz not null default now()
);
create index photos_user_idx on public.photos(user_id, position);

create table public.likes (
  from_user  uuid not null references public.profiles(id) on delete cascade,
  to_user    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (from_user, to_user),
  check (from_user <> to_user)
);
create index likes_to_idx on public.likes(to_user);

create table public.passes (
  from_user  uuid not null references public.profiles(id) on delete cascade,
  to_user    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (from_user, to_user)
);

create table public.matches (
  id         uuid primary key default gen_random_uuid(),
  user_a     uuid not null references public.profiles(id) on delete cascade,
  user_b     uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (user_a < user_b),
  unique (user_a, user_b)
);

create table public.messages (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references public.matches(id) on delete cascade,
  sender_id  uuid not null references public.profiles(id) on delete cascade,
  body       text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index messages_match_idx on public.messages(match_id, created_at);

create table public.blocks (
  blocker    uuid not null references public.profiles(id) on delete cascade,
  blocked    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);

create table public.reports (
  id         uuid primary key default gen_random_uuid(),
  reporter   uuid not null references public.profiles(id) on delete cascade,
  reported   uuid not null references public.profiles(id) on delete cascade,
  reason     text not null check (char_length(reason) between 3 and 500),
  created_at timestamptz not null default now()
);

-- ---------- RULES ENFORCED IN THE DATABASE ---------------------------

-- 18+ only (cannot be bypassed from the browser)
create or replace function public.enforce_adult()
returns trigger language plpgsql as $$
begin
  if new.birth_date > (current_date - interval '18 years')::date then
    raise exception 'You must be 18 or older to use CampusCrush.';
  end if;
  return new;
end $$;
create trigger profiles_adult before insert or update of birth_date on public.profiles
  for each row execute function public.enforce_adult();

-- Max 6 photos per person
create or replace function public.enforce_photo_limit()
returns trigger language plpgsql as $$
begin
  if (select count(*) from public.photos where user_id = new.user_id) >= 6 then
    raise exception 'You can upload up to 6 photos.';
  end if;
  return new;
end $$;
create trigger photos_limit before insert on public.photos
  for each row execute function public.enforce_photo_limit();

-- ---------- HELPERS ---------------------------------------------------

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

-- ---------- ROW LEVEL SECURITY ---------------------------------------

alter table public.profiles          enable row level security;
alter table public.profile_locations enable row level security;
alter table public.photos            enable row level security;
alter table public.likes             enable row level security;
alter table public.passes            enable row level security;
alter table public.matches           enable row level security;
alter table public.messages          enable row level security;
alter table public.blocks            enable row level security;
alter table public.reports           enable row level security;

-- Other members are returned by preference-checked functions, not unrestricted table reads.
create policy "profiles read"   on public.profiles for select to authenticated using (id = auth.uid());
create policy "profiles insert" on public.profiles for insert to authenticated
  with check (id = auth.uid());
create policy "profiles update" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- exact location: owner only
create policy "location own read"   on public.profile_locations for select to authenticated using (user_id = auth.uid());
create policy "location own insert" on public.profile_locations for insert to authenticated with check (user_id = auth.uid());
create policy "location own update" on public.profile_locations for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Photos are private by default; update_4.sql grants access only to eligible profiles and matches.
create policy "photos read"   on public.photos for select to authenticated using (user_id = auth.uid());
create policy "photos insert" on public.photos for insert to authenticated with check (user_id = auth.uid());
create policy "photos delete" on public.photos for delete to authenticated using (user_id = auth.uid());

-- likes: you can only read your own; creating likes goes through like_user() so the 6/day limit can't be skipped
create policy "likes own read" on public.likes for select to authenticated using (from_user = auth.uid());

-- passes
create policy "passes own read"   on public.passes for select to authenticated using (from_user = auth.uid());
create policy "passes own insert" on public.passes for insert to authenticated with check (from_user = auth.uid());
create policy "passes own update" on public.passes for update to authenticated using (from_user = auth.uid()) with check (from_user = auth.uid());

-- matches: only the two people in it
create policy "matches members read" on public.matches for select to authenticated
  using (auth.uid() in (user_a, user_b));

-- messages: only members of the match, and only as yourself
create policy "messages members read" on public.messages for select to authenticated
  using (exists (select 1 from public.matches m where m.id = match_id and auth.uid() in (m.user_a, m.user_b)));
create policy "messages members send" on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (select 1 from public.matches m where m.id = match_id and auth.uid() in (m.user_a, m.user_b))
  );

-- blocks: you can see and lift your own blocks; blocking goes through block_user()
create policy "blocks own read"   on public.blocks for select to authenticated using (blocker = auth.uid());
create policy "blocks own delete" on public.blocks for delete to authenticated using (blocker = auth.uid());

-- reports: you can file reports, nobody can read them from the app (view them in the dashboard)
create policy "reports insert" on public.reports for insert to authenticated with check (reporter = auth.uid());

-- ---------- APP FUNCTIONS (called from the website) -------------------

-- Likes used today (South African time)
create or replace function public.likes_left()
returns int language sql stable security definer set search_path = public as $$
  select greatest(0, 6 - count(*))::int
  from public.likes
  where from_user = auth.uid()
    and (created_at at time zone 'Africa/Johannesburg')::date = (now() at time zone 'Africa/Johannesburg')::date;
$$;

-- Like someone. Enforces 6 per day. Creates a match if they already liked you.
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
  if not exists (select 1 from profiles where id = me) then raise exception 'Finish your profile first.'; end if;
  if not exists (select 1 from profiles where id = target) or is_blocked(me, target) then
    raise exception 'This person is not available.';
  end if;

  select count(*) into used from likes
   where from_user = me
     and (created_at at time zone 'Africa/Johannesburg')::date = (now() at time zone 'Africa/Johannesburg')::date;

  if exists (select 1 from likes where from_user = me and to_user = target) then
    return json_build_object('matched', false, 'match_id', null, 'remaining', greatest(0, 6 - used));
  end if;

  if used >= 6 then raise exception 'DAILY_LIMIT'; end if;

  insert into likes (from_user, to_user) values (me, target);
  used := used + 1;

  if exists (select 1 from likes where from_user = target and to_user = me) then
    a := least(me, target); b := greatest(me, target);
    insert into matches (user_a, user_b) values (a, b) on conflict do nothing;
    select id into mid from matches where user_a = a and user_b = b;
    matched := true;
  end if;

  return json_build_object('matched', matched, 'match_id', mid, 'remaining', greatest(0, 6 - used));
end $$;

-- Block someone: hides you from each other, deletes the match, the chat and likes.
create or replace function public.block_user(target uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Please sign in.'; end if;
  if me = target then raise exception 'You cannot block yourself.'; end if;
  insert into blocks (blocker, blocked) values (me, target) on conflict do nothing;
  delete from likes   where (from_user = me and to_user = target) or (from_user = target and to_user = me);
  delete from passes  where (from_user = me and to_user = target) or (from_user = target and to_user = me);
  delete from matches where user_a = least(me, target) and user_b = greatest(me, target);
end $$;

-- People near you (within YOUR distance setting) that you haven't liked, passed on recently, or blocked.
create or replace function public.discover_profiles(lim int default 20)
returns table (
  id uuid, name text, birth_date date, university text, city text,
  bio text, interests text[], distance_km int
)
language sql stable security definer set search_path = public as $$
  with me as (
    select p.id, p.max_distance_km, l.lat, l.lng
    from profiles p left join profile_locations l on l.user_id = p.id
    where p.id = auth.uid()
  )
  select p.id, p.name, p.birth_date, p.university, p.city, p.bio, p.interests,
         case when d.km is null then null else round(d.km)::int end as distance_km
  from profiles p
  cross join me
  left join profile_locations pl on pl.user_id = p.id
  cross join lateral (
    select case when me.lat is null or pl.lat is null then null else
      6371 * 2 * asin(least(1, sqrt(
        power(sin(radians(pl.lat - me.lat) / 2), 2) +
        cos(radians(me.lat)) * cos(radians(pl.lat)) * power(sin(radians(pl.lng - me.lng) / 2), 2)
      )))
    end as km
  ) d
  where p.id <> me.id
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

grant execute on function public.likes_left()              to authenticated;
grant execute on function public.like_user(uuid)           to authenticated;
grant execute on function public.block_user(uuid)          to authenticated;
grant execute on function public.discover_profiles(int)    to authenticated;
revoke execute on function public.like_user(uuid), public.block_user(uuid),
  public.discover_profiles(int), public.likes_left() from anon;

-- ---------- PHOTO STORAGE ---------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "photos bucket upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "photos bucket delete own folder" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "photos bucket read" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- LIVE CHAT -------------------------------------------------
alter publication supabase_realtime add table public.messages;
