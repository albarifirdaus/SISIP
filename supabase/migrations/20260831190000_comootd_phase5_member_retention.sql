-- COMOOTD Phase 5: private member retention primitives.
-- Saves, collections, follows, and viewing history are visible only to their owner.

create table if not exists public.comootd_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint comootd_collections_name_check check (char_length(btrim(name)) between 1 and 60),
  unique (id, user_id)
);

create unique index if not exists comootd_collections_user_name_unique
  on public.comootd_collections (user_id, lower(btrim(name)));
create unique index if not exists comootd_collections_one_default_per_user
  on public.comootd_collections (user_id) where is_default;
create index if not exists comootd_collections_user_updated_idx
  on public.comootd_collections (user_id, updated_at desc);

drop trigger if exists comootd_collections_set_updated_at on public.comootd_collections;
create trigger comootd_collections_set_updated_at
  before update on public.comootd_collections
  for each row execute procedure public.set_updated_at();

create table if not exists public.comootd_saved_items (
  collection_id uuid not null,
  user_id uuid not null,
  target_type text not null,
  target_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (collection_id, target_type, target_id),
  constraint comootd_saved_items_collection_owner_fk
    foreign key (collection_id, user_id)
    references public.comootd_collections(id, user_id) on delete cascade,
  constraint comootd_saved_items_type_check check (target_type in ('look', 'product'))
);

create index if not exists comootd_saved_items_user_created_idx
  on public.comootd_saved_items (user_id, created_at desc);
create index if not exists comootd_saved_items_target_idx
  on public.comootd_saved_items (target_type, target_id);

create table if not exists public.comootd_curator_follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  curator_id uuid not null references public.curator_profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, curator_id),
  constraint comootd_curator_follows_not_self check (follower_id <> curator_id)
);

create index if not exists comootd_curator_follows_follower_created_idx
  on public.comootd_curator_follows (follower_id, created_at desc);
create index if not exists comootd_curator_follows_curator_idx
  on public.comootd_curator_follows (curator_id);

create table if not exists public.comootd_recently_viewed (
  user_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null,
  target_id uuid not null,
  viewed_at timestamptz not null default now(),
  primary key (user_id, target_type, target_id),
  constraint comootd_recently_viewed_type_check check (target_type in ('look', 'product', 'curator'))
);

create index if not exists comootd_recently_viewed_user_viewed_idx
  on public.comootd_recently_viewed (user_id, viewed_at desc);

alter table public.comootd_collections enable row level security;
alter table public.comootd_saved_items enable row level security;
alter table public.comootd_curator_follows enable row level security;
alter table public.comootd_recently_viewed enable row level security;

drop policy if exists "Members read own COMOOTD collections" on public.comootd_collections;
create policy "Members read own COMOOTD collections"
  on public.comootd_collections for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Members create own COMOOTD collections" on public.comootd_collections;
create policy "Members create own COMOOTD collections"
  on public.comootd_collections for insert to authenticated
  with check ((select auth.uid()) = user_id and not is_default);

drop policy if exists "Members update own COMOOTD collections" on public.comootd_collections;
create policy "Members update own COMOOTD collections"
  on public.comootd_collections for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and not is_default);

drop policy if exists "Members delete own non-default COMOOTD collections" on public.comootd_collections;
create policy "Members delete own non-default COMOOTD collections"
  on public.comootd_collections for delete to authenticated
  using ((select auth.uid()) = user_id and not is_default);

drop policy if exists "Members read own COMOOTD saved items" on public.comootd_saved_items;
create policy "Members read own COMOOTD saved items"
  on public.comootd_saved_items for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Members read own COMOOTD follows" on public.comootd_curator_follows;
create policy "Members read own COMOOTD follows"
  on public.comootd_curator_follows for select to authenticated
  using ((select auth.uid()) = follower_id);

drop policy if exists "Members follow active COMOOTD curators" on public.comootd_curator_follows;
create policy "Members follow active COMOOTD curators"
  on public.comootd_curator_follows for insert to authenticated
  with check (
    (select auth.uid()) = follower_id
    and exists (
      select 1 from public.curator_profiles cp
      where cp.user_id = curator_id and cp.is_active
    )
  );

drop policy if exists "Members unfollow own COMOOTD curators" on public.comootd_curator_follows;
create policy "Members unfollow own COMOOTD curators"
  on public.comootd_curator_follows for delete to authenticated
  using ((select auth.uid()) = follower_id);

drop policy if exists "Members read own COMOOTD history" on public.comootd_recently_viewed;
create policy "Members read own COMOOTD history"
  on public.comootd_recently_viewed for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Members create own COMOOTD history" on public.comootd_recently_viewed;
create policy "Members create own COMOOTD history"
  on public.comootd_recently_viewed for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Members update own COMOOTD history" on public.comootd_recently_viewed;
create policy "Members update own COMOOTD history"
  on public.comootd_recently_viewed for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Members delete own COMOOTD history" on public.comootd_recently_viewed;
create policy "Members delete own COMOOTD history"
  on public.comootd_recently_viewed for delete to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.toggle_comootd_saved_item(
  p_target_type text,
  p_target_id uuid,
  p_collection_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_collection_id uuid := p_collection_id;
  v_removed boolean := false;
begin
  if v_user_id is null then raise exception 'Masuk terlebih dahulu untuk menyimpan item.'; end if;
  if p_target_type not in ('look', 'product') then raise exception 'Jenis item belum valid.'; end if;
  if p_target_type = 'look' and not exists (
    select 1 from public.looks l where l.id = p_target_id and l.status = 'published' and l.published_at <= now()
  ) then raise exception 'Look tidak tersedia untuk disimpan.'; end if;
  if p_target_type = 'product' and not exists (
    select 1 from public.products p where p.id = p_target_id and p.status = 'published' and p.published_at <= now() and p.is_available
  ) then raise exception 'Produk tidak tersedia untuk disimpan.'; end if;

  if v_collection_id is null then
    insert into public.comootd_collections (user_id, name, is_default)
    values (v_user_id, 'Disimpan', true)
    on conflict (user_id) where is_default do update set updated_at = now()
    returning id into v_collection_id;
  elsif not exists (
    select 1 from public.comootd_collections c where c.id = v_collection_id and c.user_id = v_user_id
  ) then
    raise exception 'Koleksi tidak tersedia.';
  end if;

  delete from public.comootd_saved_items si
  where si.collection_id = v_collection_id
    and si.user_id = v_user_id
    and si.target_type = p_target_type
    and si.target_id = p_target_id
  returning true into v_removed;
  if v_removed then return false; end if;

  insert into public.comootd_saved_items (collection_id, user_id, target_type, target_id)
  values (v_collection_id, v_user_id, p_target_type, p_target_id);
  update public.comootd_collections set updated_at = now() where id = v_collection_id;
  return true;
end;
$$;

create or replace function public.toggle_comootd_curator_follow(p_curator_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare v_removed boolean := false;
begin
  if auth.uid() is null then raise exception 'Masuk terlebih dahulu untuk mengikuti Curator.'; end if;
  if not exists (select 1 from public.curator_profiles cp where cp.user_id = p_curator_id and cp.is_active) then
    raise exception 'Curator tidak tersedia.';
  end if;
  if auth.uid() = p_curator_id then raise exception 'Kamu tidak perlu mengikuti profil sendiri.'; end if;
  delete from public.comootd_curator_follows
  where follower_id = auth.uid() and curator_id = p_curator_id
  returning true into v_removed;
  if v_removed then return false; end if;
  insert into public.comootd_curator_follows (follower_id, curator_id)
  values (auth.uid(), p_curator_id) on conflict do nothing;
  return true;
end;
$$;

create or replace function public.record_comootd_recent_view(p_target_type text, p_target_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then return; end if;
  if p_target_type not in ('look', 'product', 'curator') then raise exception 'Jenis riwayat belum valid.'; end if;
  if p_target_type = 'look' and not exists (
    select 1 from public.looks l where l.id = p_target_id and l.status = 'published' and l.published_at <= now()
  ) then return; end if;
  if p_target_type = 'product' and not exists (
    select 1 from public.products p where p.id = p_target_id and p.status = 'published' and p.published_at <= now()
  ) then return; end if;
  if p_target_type = 'curator' and not exists (
    select 1 from public.curator_profiles cp where cp.user_id = p_target_id and cp.is_active
  ) then return; end if;

  insert into public.comootd_recently_viewed (user_id, target_type, target_id, viewed_at)
  values (auth.uid(), p_target_type, p_target_id, now())
  on conflict (user_id, target_type, target_id) do update set viewed_at = excluded.viewed_at;

  delete from public.comootd_recently_viewed rv
  where rv.user_id = auth.uid()
    and (rv.target_type, rv.target_id) in (
      select old.target_type, old.target_id
      from public.comootd_recently_viewed old
      where old.user_id = auth.uid()
      order by old.viewed_at desc
      offset 40
    );
end;
$$;

revoke all on table public.comootd_collections, public.comootd_saved_items,
  public.comootd_curator_follows, public.comootd_recently_viewed
  from public, anon, authenticated;
grant select, insert, update, delete on table public.comootd_collections to authenticated;
grant select on table public.comootd_saved_items to authenticated;
grant select, insert, delete on table public.comootd_curator_follows to authenticated;
grant select, insert, update, delete on table public.comootd_recently_viewed to authenticated;

revoke all on function public.toggle_comootd_saved_item(text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.toggle_comootd_curator_follow(uuid) from public, anon, authenticated;
revoke all on function public.record_comootd_recent_view(text, uuid) from public, anon, authenticated;
grant execute on function public.toggle_comootd_saved_item(text, uuid, uuid) to authenticated;
grant execute on function public.toggle_comootd_curator_follow(uuid) to authenticated;
grant execute on function public.record_comootd_recent_view(text, uuid) to authenticated;

