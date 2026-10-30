-- myArqiv: private collections, mutual friendships and direct recommendations.
-- Apply once in the project's SQL editor. Passwords and emails remain in Supabase Auth.
begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40 and display_name !~ '[[:cntrl:]]'),
  share_watched boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.friendships (
  user_low uuid not null references public.profiles(id) on delete cascade,
  user_high uuid not null references public.profiles(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (user_low, user_high),
  check (user_low < user_high),
  check (requested_by in (user_low, user_high))
);
create index friendships_high on public.friendships(user_high);

create table public.user_media (
  user_id uuid not null references public.profiles(id) on delete cascade,
  collection text not null check (collection in ('watchlist', 'watched')),
  source_mode text not null check (source_mode in ('demo', 'tmdb')),
  media_type text not null check (media_type in ('movie', 'tv')),
  media_id bigint not null check (media_id between 1 and 9007199254740991),
  title text not null check (char_length(title) between 1 and 300),
  original_language text not null default '' check (char_length(original_language) <= 12),
  release_year text not null default '' check (release_year = '' or release_year ~ '^[0-9]{4}$'),
  poster_url text check (poster_url is null or (char_length(poster_url) <= 300 and poster_url ~ '^https://image[.]tmdb[.]org/t/p/w500/[A-Za-z0-9_.-]+$')),
  added_at timestamptz not null default now(),
  primary key (user_id, collection, source_mode, media_type, media_id)
);
create index user_media_recent on public.user_media(user_id, collection, added_at desc);

create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  source_mode text not null check (source_mode in ('demo', 'tmdb')),
  media_type text not null check (media_type in ('movie', 'tv')),
  media_id bigint not null check (media_id between 1 and 9007199254740991),
  title text not null check (char_length(title) between 1 and 300),
  original_language text not null default '' check (char_length(original_language) <= 12),
  release_year text not null default '' check (release_year = '' or release_year ~ '^[0-9]{4}$'),
  poster_url text check (poster_url is null or (char_length(poster_url) <= 300 and poster_url ~ '^https://image[.]tmdb[.]org/t/p/w500/[A-Za-z0-9_.-]+$')),
  note text not null default '' check (char_length(note) <= 280),
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id),
  unique (sender_id, recipient_id, source_mode, media_type, media_id)
);
create index recommendations_inbox on public.recommendations(recipient_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.user_media enable row level security;
alter table public.recommendations enable row level security;

-- This definer helper can inspect only the caller's own relationship, avoiding recursive RLS.
create function public.is_friend(other_user uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.friendships f where f.user_low = least(auth.uid(), other_user)
      and f.user_high = greatest(auth.uid(), other_user) and f.status = 'accepted'
  );
$$;
revoke all on function public.is_friend(uuid) from public, anon;
grant execute on function public.is_friend(uuid) to authenticated;

-- Public app identity only: no email, password or collection counts in profiles.
create policy profiles_read on public.profiles for select to authenticated using (true);
create policy profiles_create on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy profiles_edit on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy friends_read on public.friendships for select to authenticated using ((select auth.uid()) in (user_low, user_high));
create policy friends_request on public.friendships for insert to authenticated with check (
  requested_by = (select auth.uid()) and (select auth.uid()) in (user_low, user_high) and status = 'pending'
);
create policy friends_remove on public.friendships for delete to authenticated using ((select auth.uid()) in (user_low, user_high));

create policy media_read on public.user_media for select to authenticated using (
  user_id = (select auth.uid()) or (
    collection = 'watched' and public.is_friend(user_id)
    and exists (select 1 from public.profiles p where p.id = user_id and p.share_watched)
  )
);
create policy media_add on public.user_media for insert to authenticated with check (user_id = (select auth.uid()));
create policy media_remove on public.user_media for delete to authenticated using (user_id = (select auth.uid()));

create policy recommendations_read on public.recommendations for select to authenticated using ((select auth.uid()) in (sender_id, recipient_id));
create policy recommendations_send on public.recommendations for insert to authenticated with check (
  sender_id = (select auth.uid()) and public.is_friend(recipient_id)
);
create policy recommendations_remove on public.recommendations for delete to authenticated using ((select auth.uid()) in (sender_id, recipient_id));

-- Only a request's recipient may accept. Direct updates to friendship rows are not granted.
create function public.accept_friend(other_user uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  update public.friendships set status = 'accepted'
    where user_low = least(auth.uid(), other_user) and user_high = greatest(auth.uid(), other_user)
      and status = 'pending' and requested_by <> auth.uid()
      and auth.uid() in (user_low, user_high);
  if not found then raise exception 'Incoming friend request not found.' using errcode = '42501'; end if;
end;
$$;
revoke all on function public.accept_friend(uuid) from public, anon;
grant execute on function public.accept_friend(uuid) to authenticated;

-- An invoker function keeps RLS in force and moves watchlist -> watched atomically.
create function public.save_media(
  p_collection text, p_source_mode text, p_media_type text, p_media_id bigint,
  p_title text, p_original_language text, p_release_year text, p_poster_url text
) returns void language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  insert into public.user_media(user_id, collection, source_mode, media_type, media_id, title, original_language, release_year, poster_url)
    values (auth.uid(), p_collection, p_source_mode, p_media_type, p_media_id, p_title, p_original_language, p_release_year, p_poster_url)
    on conflict do nothing;
  if p_collection = 'watched' then
    delete from public.user_media where user_id = auth.uid() and collection = 'watchlist'
      and source_mode = p_source_mode and media_type = p_media_type and media_id = p_media_id;
  end if;
end;
$$;
revoke all on function public.save_media(text,text,text,bigint,text,text,text,text) from public, anon;
grant execute on function public.save_media(text,text,text,bigint,text,text,text,text) to authenticated;

-- Revoke implicit table grants; only these operations are exposed to app sessions.
revoke all on public.profiles, public.friendships, public.user_media, public.recommendations from anon, authenticated;
grant select, insert on public.profiles to authenticated;
grant update (display_name, share_watched) on public.profiles to authenticated;
grant select, insert, delete on public.friendships, public.user_media, public.recommendations to authenticated;

commit;
