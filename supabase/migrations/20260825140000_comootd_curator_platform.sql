-- COMOOTD Curator platform
--
-- Curators own their public profile and publish their own Looks immediately.
-- Legacy catalogue data (products, product_variants, and look_items) remains
-- untouched. New Curator items live directly under a Look so a Curator never
-- needs a private product library.

-- -----------------------------------------------------------------------------
-- Private authorization and validation helpers
-- -----------------------------------------------------------------------------

create table if not exists private.comootd_account_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  account_role text not null default 'member'
    check (account_role in ('member', 'contributor', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

revoke all on table private.comootd_account_roles from public, anon, authenticated;

-- Keep the existing email-based admin bootstrap working, while allowing the
-- application to have a durable role record for each account.
insert into private.comootd_account_roles (user_id, account_role)
select
  u.id,
  case
    when pg_catalog.lower(coalesce(u.email, '')) = 'albarifirdaus209@gmail.com' then 'admin'
    else 'member'
  end
from auth.users as u
on conflict (user_id) do update
set account_role = case
  when excluded.account_role = 'admin' then 'admin'
  else private.comootd_account_roles.account_role
end;

create or replace function private.is_sisip_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
      from private.comootd_account_roles as r
      where r.user_id = (select auth.uid())
        and r.account_role = 'admin'
    )
    or exists (
      select 1
      from auth.users as u
      where u.id = (select auth.uid())
        and pg_catalog.lower(u.email) = 'albarifirdaus209@gmail.com'
    );
$$;

revoke all on function private.is_sisip_admin() from public, anon, authenticated;
grant execute on function private.is_sisip_admin() to authenticated;

create or replace function private.are_valid_comootd_tags(
  p_tags text[],
  p_max_count integer,
  p_max_length integer
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    p_max_count >= 0
    and p_max_length >= 1
    and pg_catalog.cardinality(coalesce(p_tags, array[]::text[])) <= p_max_count
    and not exists (
      select 1
      from pg_catalog.unnest(coalesce(p_tags, array[]::text[])) as supplied(value)
      where supplied.value is null
        or pg_catalog.char_length(pg_catalog.btrim(supplied.value)) = 0
        or pg_catalog.char_length(pg_catalog.btrim(supplied.value)) > p_max_length
    )
    and not exists (
      select pg_catalog.lower(pg_catalog.btrim(supplied.value))
      from pg_catalog.unnest(coalesce(p_tags, array[]::text[])) as supplied(value)
      group by pg_catalog.lower(pg_catalog.btrim(supplied.value))
      having count(*) > 1
    ),
    false
  );
$$;

revoke all on function private.are_valid_comootd_tags(text[], integer, integer)
  from public, anon, authenticated;
grant execute on function private.are_valid_comootd_tags(text[], integer, integer)
  to authenticated;

-- Every new Auth user remains a normal member until an existing admin enables
-- Curator access. This function is invoked only by the auth.users trigger.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'display_name'), ''), 'COMOOTD Member')
  )
  on conflict (id) do nothing;

  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into private.comootd_account_roles (user_id, account_role)
  values (
    new.id,
    case
      when pg_catalog.lower(coalesce(new.email, '')) = 'albarifirdaus209@gmail.com' then 'admin'
      else 'member'
    end
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Public Curator profile
-- -----------------------------------------------------------------------------

create table if not exists public.curator_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  handle text not null unique
    default ('curator-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 12))
    check (handle ~ '^[a-z0-9]+(?:[a-z0-9_-]*[a-z0-9])?$' and char_length(handle) between 3 and 32),
  display_name text not null default 'COMOOTD Curator'
    check (char_length(btrim(display_name)) between 1 and 80),
  avatar_path text
    check (
      avatar_path is null
      or (
        char_length(avatar_path) <= 512
        and avatar_path ~ '^curators/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/avatar/.+'
      )
    ),
  bio text
    check (bio is null or char_length(btrim(bio)) between 1 and 500),
  job_tags text[] not null default array[]::text[]
    check (private.are_valid_comootd_tags(job_tags, 5, 48)),
  is_active boolean not null default true,
  active_look_limit integer not null default 30
    check (active_look_limit between 0 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists curator_profiles_set_updated_at on public.curator_profiles;
create trigger curator_profiles_set_updated_at
  before update on public.curator_profiles
  for each row execute procedure public.set_updated_at();

-- Social links are rows rather than JSON so the public profile loader can read,
-- order, and render them directly without exposing an editable JSON payload.
create table if not exists public.contributor_social_links (
  id uuid primary key default gen_random_uuid(),
  contributor_id uuid not null references public.curator_profiles(user_id) on delete cascade,
  platform text not null check (platform in ('instagram', 'tiktok', 'youtube', 'pinterest', 'website')),
  url text not null check (
    char_length(btrim(url)) between 8 and 500
    and lower(btrim(url)) ~ '^https://'
  ),
  sort_order smallint not null default 0 check (sort_order between 0 and 4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contributor_social_links_contributor_platform_key unique (contributor_id, platform),
  constraint contributor_social_links_contributor_sort_order_key unique (contributor_id, sort_order)
);

drop trigger if exists contributor_social_links_set_updated_at on public.contributor_social_links;
create trigger contributor_social_links_set_updated_at
  before update on public.contributor_social_links
  for each row execute procedure public.set_updated_at();

create index if not exists contributor_social_links_contributor_idx
  on public.contributor_social_links (contributor_id, sort_order);

create or replace function private.is_active_comootd_curator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select auth.uid()) is not null
    and exists (
      select 1
      from private.comootd_account_roles as r
      join public.curator_profiles as cp on cp.user_id = r.user_id
      where r.user_id = (select auth.uid())
        and r.account_role = 'contributor'
        and cp.is_active
    ),
    false
  );
$$;

-- A Curator can only point their public avatar to their own object path. The
-- active-status check belongs in storage policies so a suspended Curator can
-- still edit their text profile without losing a previously uploaded avatar.
create or replace function private.is_own_comootd_curator_avatar_path(p_path text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_path is null
    or exists (
      select 1
      from (
        select storage.foldername(p_path) as parts
      ) as path
      where (select auth.uid()) is not null
        and path.parts[1] = 'curators'
        and path.parts[2] = (select auth.uid())::text
        and path.parts[3] = 'avatar'
        and path.parts[4] is not null
    );
$$;

create or replace function private.is_own_comootd_curator_media_path(p_path text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select private.is_active_comootd_curator())
    and exists (
      select 1
      from (
        select storage.foldername(p_path) as parts
      ) as path
      where path.parts[1] = 'curators'
        and path.parts[2] = (select auth.uid())::text
        and (
          (path.parts[3] = 'avatar' and path.parts[4] is not null)
          or
          (path.parts[3] = 'looks'
            and path.parts[4] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            and path.parts[5] is not null)
        )
    ),
    false
  );
$$;

revoke all on function private.is_active_comootd_curator() from public, anon, authenticated;
revoke all on function private.is_own_comootd_curator_avatar_path(text) from public, anon, authenticated;
revoke all on function private.is_own_comootd_curator_media_path(text) from public, anon, authenticated;
grant execute on function private.is_active_comootd_curator() to authenticated;
grant execute on function private.is_own_comootd_curator_avatar_path(text) to authenticated;
grant execute on function private.is_own_comootd_curator_media_path(text) to authenticated;

-- The only role-management endpoint is intentionally admin-only. It creates
-- the public profile at the same time, starts every Curator at 30 active Looks,
-- and lets the admin adjust that quota later without exposing role columns.
create or replace function public.admin_set_comootd_curator_access(
  p_user_id uuid,
  p_is_active boolean default true,
  p_active_look_limit integer default 30
)
returns public.curator_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.curator_profiles%rowtype;
begin
  if (select auth.uid()) is null or not (select private.is_sisip_admin()) then
    raise exception 'Only a COMOOTD admin can manage Curator access.' using errcode = '42501';
  end if;

  if p_user_id is null or not exists (
    select 1 from public.profiles as p where p.id = p_user_id
  ) then
    raise exception 'Akun yang akan dijadikan Curator tidak ditemukan.';
  end if;

  if p_is_active is null then
    raise exception 'Status aktif Curator wajib diisi.';
  end if;

  if p_active_look_limit is null or p_active_look_limit not between 0 and 1000 then
    raise exception 'Limit Look Curator harus antara 0 dan 1000.';
  end if;

  if exists (
    select 1
    from private.comootd_account_roles as r
    where r.user_id = p_user_id and r.account_role = 'admin'
  ) then
    raise exception 'Akun admin tidak dapat diubah menjadi Curator melalui endpoint ini.';
  end if;

  insert into private.comootd_account_roles (user_id, account_role)
  values (p_user_id, 'contributor')
  on conflict (user_id) do update
    set account_role = 'contributor', updated_at = now();

  insert into public.curator_profiles (
    user_id,
    display_name,
    is_active,
    active_look_limit
  )
  select p.id, coalesce(nullif(btrim(p.display_name), ''), 'COMOOTD Curator'), p_is_active, p_active_look_limit
  from public.profiles as p
  where p.id = p_user_id
  on conflict (user_id) do update
    set is_active = excluded.is_active,
        active_look_limit = excluded.active_look_limit,
        updated_at = now()
  returning * into v_profile;

  return v_profile;
end;
$$;

revoke all on function public.admin_set_comootd_curator_access(uuid, boolean, integer)
  from public, anon, authenticated;
grant execute on function public.admin_set_comootd_curator_access(uuid, boolean, integer)
  to authenticated;

-- Open Curator activation is free, but still creates a role through a narrow
-- RPC rather than letting a member write authorization fields directly. An
-- admin suspension cannot be bypassed by re-running this endpoint.
create or replace function public.activate_comootd_curator(
  p_handle text,
  p_bio text,
  p_job_tags text[]
)
returns public.curator_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_handle text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_handle, '')));
  v_bio text := nullif(pg_catalog.btrim(coalesce(p_bio, '')), '');
  v_job_tags text[];
  v_profile public.curator_profiles%rowtype;
begin
  if v_actor_id is null then
    raise exception 'Masuk terlebih dahulu untuk mengaktifkan akun Curator.' using errcode = '42501';
  end if;

  if (select private.is_sisip_admin()) then
    raise exception 'Akun admin tidak perlu diaktifkan sebagai Curator.';
  end if;

  if v_handle !~ '^[a-z0-9]+(?:[a-z0-9_-]*[a-z0-9])?$'
    or char_length(v_handle) not between 3 and 32 then
    raise exception 'Handle harus 3–32 karakter: huruf kecil, angka, _ atau -.';
  end if;

  if v_bio is not null and char_length(v_bio) > 500 then
    raise exception 'Bio Curator maksimal 500 karakter.';
  end if;

  if coalesce(pg_catalog.cardinality(p_job_tags), 0) > 5 then
    raise exception 'Curator maksimal memiliki 5 job tag.';
  end if;

  select coalesce(array_agg(cleaned.tag order by cleaned.position), array[]::text[])
  into v_job_tags
  from (
    select pg_catalog.btrim(supplied.tag) as tag, supplied.position
    from pg_catalog.unnest(coalesce(p_job_tags, array[]::text[])) with ordinality as supplied(tag, position)
    where pg_catalog.btrim(coalesce(supplied.tag, '')) <> ''
  ) as cleaned;

  if not (select private.are_valid_comootd_tags(v_job_tags, 5, 48)) then
    raise exception 'Job tag Curator belum valid.';
  end if;

  if exists (
    select 1
    from public.curator_profiles as cp
    where cp.handle = v_handle
      and cp.user_id <> v_actor_id
  ) then
    raise exception 'Handle Curator tersebut sudah digunakan.';
  end if;

  if exists (
    select 1
    from public.curator_profiles as cp
    where cp.user_id = v_actor_id
      and not cp.is_active
  ) then
    raise exception 'Akun Curator ini sedang dinonaktifkan. Hubungi COMOOTD.' using errcode = '42501';
  end if;

  insert into private.comootd_account_roles (user_id, account_role)
  values (v_actor_id, 'contributor')
  on conflict (user_id) do update
    set account_role = 'contributor', updated_at = now();

  insert into public.curator_profiles (
    user_id,
    handle,
    display_name,
    bio,
    job_tags,
    is_active,
    active_look_limit
  )
  select
    p.id,
    v_handle,
    coalesce(nullif(btrim(p.display_name), ''), 'COMOOTD Curator'),
    v_bio,
    v_job_tags,
    true,
    30
  from public.profiles as p
  where p.id = v_actor_id
  on conflict (user_id) do update
    set handle = excluded.handle,
        bio = excluded.bio,
        job_tags = excluded.job_tags,
        updated_at = now()
  returning * into v_profile;

  return v_profile;
end;
$$;

revoke all on function public.activate_comootd_curator(text, text, text[])
  from public, anon, authenticated;
grant execute on function public.activate_comootd_curator(text, text, text[])
  to authenticated;

-- -----------------------------------------------------------------------------
-- Look ownership and inline Curator curation items
-- -----------------------------------------------------------------------------

alter table public.looks add column if not exists creator_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.looks'::regclass
      and conname = 'looks_creator_id_fkey'
  ) then
    alter table public.looks
      add constraint looks_creator_id_fkey
      foreign key (creator_id) references public.profiles(id) on delete restrict;
  end if;
end;
$$;

-- Existing COMOOTD Looks belong to the pre-existing admin account. A fresh
-- project with no Looks also passes this safely before its admin is created.
update public.looks as l
set creator_id = (
  select p.id
  from public.profiles as p
  join auth.users as u on u.id = p.id
  where pg_catalog.lower(u.email) = 'albarifirdaus209@gmail.com'
  limit 1
)
where l.creator_id is null;

do $$
begin
  if exists (select 1 from public.looks where creator_id is null) then
    raise exception 'Semua Look lama harus memiliki pemilik sebelum fitur Curator diaktifkan.';
  end if;
end;
$$;

alter table public.looks alter column creator_id set not null;

create or replace function public.assign_comootd_look_creator()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.creator_id is null then
    new.creator_id := (select auth.uid());
  end if;

  if new.creator_id is null then
    raise exception 'Look harus memiliki pemilik.';
  end if;

  if tg_op = 'INSERT'
    and new.creator_id <> (select auth.uid())
    and not (select private.is_sisip_admin()) then
    raise exception 'Look hanya dapat dibuat untuk akun sendiri.' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE'
    and new.creator_id is distinct from old.creator_id
    and not (select private.is_sisip_admin()) then
    raise exception 'Pemilik Look hanya dapat diubah oleh admin.' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.assign_comootd_look_creator() from public, anon, authenticated;

drop trigger if exists looks_assign_comootd_creator on public.looks;
create trigger looks_assign_comootd_creator
  before insert or update of creator_id on public.looks
  for each row execute procedure public.assign_comootd_look_creator();

create table if not exists public.look_curation_items (
  id uuid primary key default gen_random_uuid(),
  look_id uuid not null references public.looks(id) on delete cascade,
  category text not null check (
    category in (
      'top', 'bottom', 'outerwear', 'dress', 'skirt', 'footwear', 'bag',
      'accessory', 'jewelry', 'headwear', 'hijab', 'innerwear', 'other'
    )
  ),
  name text not null check (char_length(btrim(name)) between 1 and 160),
  color_variant text check (color_variant is null or char_length(btrim(color_variant)) between 1 and 80),
  affiliate_url text not null check (
    lower(affiliate_url) ~ E'^https://([a-z0-9-]+\\.)*shopee\\.co\\.id(/|$)'
    or lower(affiliate_url) ~ E'^https://shope\\.ee(/|$)'
  ),
  position smallint not null check (position between 1 and 5),
  created_at timestamptz not null default now(),
  constraint look_curation_items_look_position_key unique (look_id, position) deferrable initially immediate
);

create index if not exists looks_creator_active_idx
  on public.looks (creator_id, created_at desc)
  where status <> 'archived';

create index if not exists look_curation_items_look_idx
  on public.look_curation_items (look_id, position);

-- A Look has exactly one source of items: the legacy catalogue variants or the
-- new inline Curator references. This keeps existing admin Looks intact.
create or replace function public.prevent_mixed_comootd_look_item_sources()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_table_name = 'look_items' then
    if exists (
      select 1 from public.look_curation_items as ci where ci.look_id = new.look_id
    ) then
      raise exception 'Satu Look tidak dapat mencampur produk library dan item Curator.';
    end if;
  elsif tg_table_name = 'look_curation_items' then
    if exists (
      select 1 from public.look_items as li where li.look_id = new.look_id
    ) then
      raise exception 'Satu Look tidak dapat mencampur produk library dan item Curator.';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.prevent_mixed_comootd_look_item_sources()
  from public, anon, authenticated;

drop trigger if exists look_items_prevent_mixed_comootd_sources on public.look_items;
create trigger look_items_prevent_mixed_comootd_sources
  before insert or update of look_id on public.look_items
  for each row execute procedure public.prevent_mixed_comootd_look_item_sources();

drop trigger if exists look_curation_items_prevent_mixed_comootd_sources on public.look_curation_items;
create trigger look_curation_items_prevent_mixed_comootd_sources
  before insert or update of look_id on public.look_curation_items
  for each row execute procedure public.prevent_mixed_comootd_look_item_sources();

-- Replace the legacy publishing guard so both legacy and Curator Looks retain
-- the same 2–5 item standard. The source-mixing trigger above means a count is
-- always unambiguous.
create or replace function public.require_valid_published_look()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_legacy_count integer;
  v_curation_count integer;
  v_item_count integer;
begin
  if new.status = 'published' then
    select count(*) into v_legacy_count
    from public.look_items as li
    where li.look_id = new.id;

    select count(*) into v_curation_count
    from public.look_curation_items as ci
    where ci.look_id = new.id;

    if v_legacy_count > 0 and v_curation_count > 0 then
      raise exception 'Satu Look hanya dapat memakai satu sumber item.';
    end if;

    v_item_count := case
      when v_legacy_count > 0 then v_legacy_count
      else v_curation_count
    end;

    if v_item_count < 2 or v_item_count > 5 then
      raise exception 'A published look must contain 2 to 5 items.';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.require_valid_published_look() from public, anon, authenticated;

drop trigger if exists looks_require_valid_items on public.looks;
create trigger looks_require_valid_items
  before insert or update of status on public.looks
  for each row execute procedure public.require_valid_published_look();

create or replace function public.prevent_invalid_published_look_curation_items()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_item_count integer;
begin
  if tg_op in ('UPDATE', 'DELETE') and exists (
      select 1
      from public.looks as l
      where l.id = old.look_id and l.status = 'published'
    ) then
      select count(*) into v_item_count
      from public.look_curation_items as ci
      where ci.look_id = old.look_id;

      if v_item_count < 2 or v_item_count > 5 then
        raise exception 'A published look must contain 2 to 5 items.';
      end if;
  end if;

  if tg_op = 'INSERT' and exists (
      select 1
      from public.looks as l
      where l.id = new.look_id and l.status = 'published'
    ) then
      select count(*) into v_item_count
      from public.look_curation_items as ci
      where ci.look_id = new.look_id;

      if v_item_count < 2 or v_item_count > 5 then
        raise exception 'A published look must contain 2 to 5 items.';
      end if;
  elsif tg_op = 'UPDATE' and new.look_id is distinct from old.look_id and exists (
      select 1
      from public.looks as l
      where l.id = new.look_id and l.status = 'published'
    ) then
      select count(*) into v_item_count
      from public.look_curation_items as ci
      where ci.look_id = new.look_id;

      if v_item_count < 2 or v_item_count > 5 then
        raise exception 'A published look must contain 2 to 5 items.';
      end if;
  end if;

  return null;
end;
$$;

revoke all on function public.prevent_invalid_published_look_curation_items()
  from public, anon, authenticated;

drop trigger if exists look_curation_items_keep_published_valid on public.look_curation_items;
create constraint trigger look_curation_items_keep_published_valid
  after insert or update or delete on public.look_curation_items
  deferrable initially deferred
  for each row execute procedure public.prevent_invalid_published_look_curation_items();

-- An active Curator can create or immediately publish only their own inline
-- Look. The quota counts all non-archived Looks, including legacy drafts, so
-- it cannot be bypassed by stockpiling work before publishing it.
create or replace function public.save_contributor_look(
  p_look_id uuid,
  p_title text,
  p_excerpt text,
  p_cover_image_path text,
  p_cover_alt_text text,
  p_gender_target text,
  p_style_tags text[],
  p_tone text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_look_id uuid;
  v_creator_id uuid;
  v_existing_status text;
  v_is_new boolean := false;
  v_is_admin boolean := (select private.is_sisip_admin());
  v_title text := pg_catalog.btrim(coalesce(p_title, ''));
  v_excerpt text := nullif(pg_catalog.btrim(coalesce(p_excerpt, '')), '');
  v_cover_image_path text := nullif(pg_catalog.btrim(coalesce(p_cover_image_path, '')), '');
  v_cover_alt_text text := nullif(pg_catalog.btrim(coalesce(p_cover_alt_text, '')), '');
  v_tone text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_tone, '')));
  v_gender_target text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_gender_target, '')));
  v_style_tags text[];
  v_item_count integer;
  v_active_look_limit integer;
  v_active_look_count integer;
  v_slug_base text;
  v_slug text;
begin
  if v_actor_id is null then
    raise exception 'Masuk terlebih dahulu untuk membuat Look.' using errcode = '42501';
  end if;

  if not v_is_admin and not (select private.is_active_comootd_curator()) then
    raise exception 'Akun ini belum memiliki akses Curator aktif.' using errcode = '42501';
  end if;

  if char_length(v_title) not between 1 and 160 then
    raise exception 'Nama Look wajib berisi 1 sampai 160 karakter.';
  end if;

  if v_excerpt is not null and char_length(v_excerpt) > 600 then
    raise exception 'Deskripsi singkat Look maksimal 600 karakter.';
  end if;

  if v_cover_alt_text is not null and char_length(v_cover_alt_text) > 250 then
    raise exception 'Teks alternatif cover maksimal 250 karakter.';
  end if;

  if v_tone not in ('carbon', 'clay', 'mineral', 'olive', 'midnight') then
    raise exception 'Arah visual Look belum sesuai pilihan COMOOTD.';
  end if;

  if v_gender_target not in ('pria', 'wanita', 'unisex') then
    raise exception 'Gender Look harus pria, wanita, atau unisex.';
  end if;

  if coalesce(pg_catalog.cardinality(p_style_tags), 0) > 12 then
    raise exception 'Look maksimal memiliki 12 tag style.';
  end if;

  select coalesce(array_agg(cleaned.tag order by cleaned.position), array[]::text[])
  into v_style_tags
  from (
    select pg_catalog.btrim(supplied.tag) as tag, supplied.position
    from pg_catalog.unnest(coalesce(p_style_tags, array[]::text[])) with ordinality as supplied(tag, position)
    where pg_catalog.btrim(coalesce(supplied.tag, '')) <> ''
  ) as cleaned;

  if coalesce(pg_catalog.cardinality(v_style_tags), 0) < 1
    or not (select private.are_valid_comootd_tags(v_style_tags, 12, 80)) then
    raise exception 'Look memerlukan 1 sampai 12 tag style yang valid.';
  end if;

  if p_items is null or pg_catalog.jsonb_typeof(p_items) <> 'array' then
    raise exception 'Item kurasi Look belum valid.';
  end if;

  select count(*) into v_item_count
  from pg_catalog.jsonb_array_elements(p_items);

  if v_item_count < 2 or v_item_count > 5 then
    raise exception 'Satu Look harus berisi 2 sampai 5 item kurasi.';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_items) as supplied(value)
    where pg_catalog.lower(pg_catalog.btrim(coalesce(supplied.value ->> 'category', ''))) not in (
        'top', 'bottom', 'outerwear', 'dress', 'skirt', 'footwear', 'bag',
        'accessory', 'jewelry', 'headwear', 'hijab', 'innerwear', 'other'
      )
      or char_length(pg_catalog.btrim(coalesce(supplied.value ->> 'name', ''))) not between 1 and 160
      or (
        nullif(pg_catalog.btrim(coalesce(supplied.value ->> 'color_variant', '')), '') is not null
        and char_length(pg_catalog.btrim(supplied.value ->> 'color_variant')) > 80
      )
      or (
        pg_catalog.lower(pg_catalog.btrim(coalesce(supplied.value ->> 'affiliate_url', ''))) !~ E'^https://([a-z0-9-]+\\.)*shopee\\.co\\.id(/|$)'
        and pg_catalog.lower(pg_catalog.btrim(coalesce(supplied.value ->> 'affiliate_url', ''))) !~ E'^https://shope\\.ee(/|$)'
      )
  ) then
    raise exception 'Setiap item memerlukan kategori, nama, dan link Shopee affiliate yang valid.';
  end if;

  if p_look_id is null then
    v_is_new := true;
    v_look_id := gen_random_uuid();
    v_creator_id := v_actor_id;
    v_existing_status := null;
  else
    select l.id, l.creator_id, l.status
    into v_look_id, v_creator_id, v_existing_status
    from public.looks as l
    where l.id = p_look_id
    for update;

    if not found then
      -- A client can pre-generate a UUID for its media upload path. It still
      -- becomes a new Look only when that UUID does not already exist.
      v_is_new := true;
      v_look_id := p_look_id;
      v_creator_id := v_actor_id;
      v_existing_status := null;
    elsif not v_is_admin and v_creator_id <> v_actor_id then
      raise exception 'Look ini bukan milik akun Curator Anda.' using errcode = '42501';
    end if;
  end if;

  if exists (
    select 1 from public.look_items as li where li.look_id = v_look_id
  ) then
    raise exception 'Look legacy harus tetap diedit melalui product library COMOOTD.';
  end if;

  -- New or restored Curator Looks consume quota. Archived Looks free a slot.
  if not v_is_admin
    and (v_is_new or v_existing_status = 'archived') then
    select cp.active_look_limit
    into v_active_look_limit
    from public.curator_profiles as cp
    join private.comootd_account_roles as r on r.user_id = cp.user_id
    where cp.user_id = v_actor_id
      and cp.is_active
      and r.account_role = 'contributor'
    for update of cp;

    if not found then
      raise exception 'Akun Curator tidak aktif.' using errcode = '42501';
    end if;

    select count(*) into v_active_look_count
    from public.looks as l
    where l.creator_id = v_actor_id
      and l.status <> 'archived'
      and l.id <> v_look_id;

    if v_active_look_count >= v_active_look_limit then
      raise exception 'Limit % Look aktif sudah tercapai. Arsipkan Look lama atau hubungi COMOOTD.', v_active_look_limit;
    end if;
  end if;

  if v_cover_image_path is not null then
    if not v_is_admin and v_cover_image_path !~ (
      '^curators/' || v_actor_id::text || '/looks/' || v_look_id::text || '/'
    ) then
      raise exception 'Cover Look harus diunggah ke folder media Curator Anda.';
    end if;

    if v_is_admin
      and v_cover_image_path !~ '^https://'
      and v_cover_image_path !~ ('^looks/' || v_look_id::text || '/')
      and v_cover_image_path !~ ('^curators/' || v_creator_id::text || '/looks/' || v_look_id::text || '/') then
      raise exception 'Path cover Look belum valid.';
    end if;
  end if;

  if v_is_new then
    v_slug_base := pg_catalog.btrim(
      pg_catalog.regexp_replace(
        pg_catalog.lower(v_title),
        '[^a-z0-9]+',
        '-',
        'g'
      ),
      '-'
    );
    if v_slug_base = '' then
      v_slug_base := 'look';
    end if;
    v_slug := left(v_slug_base, 50) || '-' || substring(v_look_id::text from 1 for 8);

    insert into public.looks (
      id,
      creator_id,
      slug,
      title,
      excerpt,
      cover_image_path,
      cover_alt_text,
      tone,
      gender_target,
      style_tags,
      status,
      published_at
    ) values (
      v_look_id,
      v_creator_id,
      v_slug,
      v_title,
      v_excerpt,
      v_cover_image_path,
      v_cover_alt_text,
      v_tone,
      v_gender_target,
      v_style_tags,
      'draft',
      null
    );
  else
    update public.looks
    set title = v_title,
        excerpt = v_excerpt,
        cover_image_path = v_cover_image_path,
        cover_alt_text = v_cover_alt_text,
        tone = v_tone,
        gender_target = v_gender_target,
        style_tags = v_style_tags
    where id = v_look_id;
  end if;

  -- The deferred constraint trigger observes the completed replacement list at
  -- commit, never the temporarily empty state during an edit of a published Look.
  delete from public.look_curation_items where look_id = v_look_id;

  insert into public.look_curation_items (
    look_id,
    category,
    name,
    color_variant,
    affiliate_url,
    position
  )
  select
    v_look_id,
    pg_catalog.lower(pg_catalog.btrim(supplied.value ->> 'category')),
    pg_catalog.btrim(supplied.value ->> 'name'),
    nullif(pg_catalog.btrim(coalesce(supplied.value ->> 'color_variant', '')), ''),
    pg_catalog.btrim(supplied.value ->> 'affiliate_url'),
    supplied.position::smallint
  from pg_catalog.jsonb_array_elements(p_items) with ordinality as supplied(value, position)
  order by supplied.position;

  update public.looks
  set status = 'published',
      published_at = coalesce(published_at, now())
  where id = v_look_id;

  return v_look_id;
end;
$$;

revoke all on function public.save_contributor_look(
  uuid, text, text, text, text, text, text[], text, jsonb
) from public, anon, authenticated;
grant execute on function public.save_contributor_look(
  uuid, text, text, text, text, text, text[], text, jsonb
) to authenticated;

-- Archiving is recoverable and frees one quota slot. Re-saving an archived
-- Curator Look publishes it again only when a slot is still available.
create or replace function public.archive_contributor_look(p_look_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_creator_id uuid;
  v_is_admin boolean := (select private.is_sisip_admin());
begin
  if v_actor_id is null then
    raise exception 'Masuk terlebih dahulu untuk mengarsipkan Look.' using errcode = '42501';
  end if;

  select l.creator_id into v_creator_id
  from public.looks as l
  where l.id = p_look_id
  for update;

  if not found then
    raise exception 'Look tidak ditemukan.';
  end if;

  if not v_is_admin and (
    v_creator_id <> v_actor_id
    or not (select private.is_active_comootd_curator())
  ) then
    raise exception 'Look ini bukan milik akun Curator Anda.' using errcode = '42501';
  end if;

  update public.looks
  set status = 'archived', published_at = null
  where id = p_look_id;

  return p_look_id;
end;
$$;

revoke all on function public.archive_contributor_look(uuid) from public, anon, authenticated;
grant execute on function public.archive_contributor_look(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Likes, public counts, and Row Level Security
-- -----------------------------------------------------------------------------

create table if not exists public.look_likes (
  look_id uuid not null references public.looks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (look_id, user_id)
);

create index if not exists look_likes_user_created_idx
  on public.look_likes (user_id, created_at desc);

-- Keep the existing public popularity field as the safe, aggregate-only like
-- counter. Individual liker identities remain private.
create or replace function private.refresh_comootd_look_popularity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_look_id uuid;
begin
  if tg_op = 'DELETE' then
    v_look_id := old.look_id;
  else
    v_look_id := new.look_id;
  end if;

  update public.looks as l
  set popularity = (
    select count(*)
    from public.look_likes as ll
    where ll.look_id = v_look_id
  )
  where l.id = v_look_id;

  return null;
end;
$$;

revoke all on function private.refresh_comootd_look_popularity() from public, anon, authenticated;

drop trigger if exists look_likes_refresh_comootd_popularity on public.look_likes;
create trigger look_likes_refresh_comootd_popularity
  after insert or delete on public.look_likes
  for each row execute procedure private.refresh_comootd_look_popularity();

alter table public.curator_profiles enable row level security;
alter table public.contributor_social_links enable row level security;
alter table public.look_curation_items enable row level security;
alter table public.look_likes enable row level security;

drop policy if exists "Public reads active COMOOTD Curator profiles" on public.curator_profiles;
create policy "Public reads active COMOOTD Curator profiles"
  on public.curator_profiles for select
  to anon, authenticated
  using (is_active);

drop policy if exists "Curators read own COMOOTD profile" on public.curator_profiles;
create policy "Curators read own COMOOTD profile"
  on public.curator_profiles for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Curators update own COMOOTD profile" on public.curator_profiles;
create policy "Curators update own COMOOTD profile"
  on public.curator_profiles for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (select private.is_own_comootd_curator_avatar_path(avatar_path))
  );

drop policy if exists "COMOOTD admin manages Curator profiles" on public.curator_profiles;
create policy "COMOOTD admin manages Curator profiles"
  on public.curator_profiles for all
  to authenticated
  using ((select private.is_sisip_admin()))
  with check ((select private.is_sisip_admin()));

drop policy if exists "Public reads active Curator social links" on public.contributor_social_links;
create policy "Public reads active Curator social links"
  on public.contributor_social_links for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.curator_profiles as cp
      where cp.user_id = contributor_id
        and cp.is_active
    )
  );

drop policy if exists "Curators read own social links" on public.contributor_social_links;
create policy "Curators read own social links"
  on public.contributor_social_links for select
  to authenticated
  using (contributor_id = (select auth.uid()));

drop policy if exists "Curators create own social links" on public.contributor_social_links;
create policy "Curators create own social links"
  on public.contributor_social_links for insert
  to authenticated
  with check (contributor_id = (select auth.uid()));

drop policy if exists "Curators update own social links" on public.contributor_social_links;
create policy "Curators update own social links"
  on public.contributor_social_links for update
  to authenticated
  using (contributor_id = (select auth.uid()))
  with check (contributor_id = (select auth.uid()));

drop policy if exists "Curators delete own social links" on public.contributor_social_links;
create policy "Curators delete own social links"
  on public.contributor_social_links for delete
  to authenticated
  using (contributor_id = (select auth.uid()));

drop policy if exists "COMOOTD admin manages Curator social links" on public.contributor_social_links;
create policy "COMOOTD admin manages Curator social links"
  on public.contributor_social_links for all
  to authenticated
  using ((select private.is_sisip_admin()))
  with check ((select private.is_sisip_admin()));

drop policy if exists "Curators read own COMOOTD looks" on public.looks;
create policy "Curators read own COMOOTD looks"
  on public.looks for select
  to authenticated
  using (
    creator_id = (select auth.uid())
    and (select private.is_active_comootd_curator())
  );

drop policy if exists "Public reads inline items for published looks" on public.look_curation_items;
create policy "Public reads inline items for published looks"
  on public.look_curation_items for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.looks as l
      where l.id = look_id
        and l.status = 'published'
        and l.published_at <= now()
    )
  );

drop policy if exists "Curators read own inline items" on public.look_curation_items;
create policy "Curators read own inline items"
  on public.look_curation_items for select
  to authenticated
  using (
    exists (
      select 1
      from public.looks as l
      where l.id = look_id
        and l.creator_id = (select auth.uid())
    )
  );

drop policy if exists "COMOOTD admin manages inline Curator items" on public.look_curation_items;
create policy "COMOOTD admin manages inline Curator items"
  on public.look_curation_items for all
  to authenticated
  using ((select private.is_sisip_admin()))
  with check ((select private.is_sisip_admin()));

drop policy if exists "Members read own COMOOTD likes" on public.look_likes;
create policy "Members read own COMOOTD likes"
  on public.look_likes for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Members like published COMOOTD looks" on public.look_likes;
create policy "Members like published COMOOTD looks"
  on public.look_likes for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.looks as l
      where l.id = look_id
        and l.status = 'published'
        and l.published_at <= now()
    )
  );

drop policy if exists "Members remove own COMOOTD likes" on public.look_likes;
create policy "Members remove own COMOOTD likes"
  on public.look_likes for delete
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "COMOOTD admin manages look likes" on public.look_likes;
create policy "COMOOTD admin manages look likes"
  on public.look_likes for all
  to authenticated
  using ((select private.is_sisip_admin()))
  with check ((select private.is_sisip_admin()));

-- A small convenience RPC keeps the client interaction atomic while leaving
-- all row access subject to the policies above (SECURITY INVOKER by design).
create or replace function public.toggle_comootd_look_like(p_look_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_removed boolean := false;
begin
  if (select auth.uid()) is null then
    raise exception 'Masuk terlebih dahulu untuk menyukai Look.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.looks as l
    where l.id = p_look_id
      and l.status = 'published'
      and l.published_at <= now()
  ) then
    raise exception 'Look tidak tersedia untuk disukai.';
  end if;

  delete from public.look_likes
  where look_id = p_look_id
    and user_id = (select auth.uid())
  returning true into v_removed;

  if found then
    return false;
  end if;

  insert into public.look_likes (look_id, user_id)
  values (p_look_id, (select auth.uid()))
  on conflict (look_id, user_id) do nothing;

  return true;
end;
$$;

revoke all on function public.toggle_comootd_look_like(uuid) from public, anon, authenticated;
grant execute on function public.toggle_comootd_look_like(uuid) to authenticated;

-- Explicit table privileges complement RLS. Curators have no direct DML policy
-- for Looks or inline items; they must use save_contributor_look(), where
-- ownership, item validation, and quota checks happen atomically.
revoke all on table public.curator_profiles, public.contributor_social_links, public.look_curation_items, public.look_likes
  from public, anon, authenticated;
grant select on table public.curator_profiles to anon, authenticated;
grant update (handle, display_name, avatar_path, bio, job_tags)
  on table public.curator_profiles to authenticated;
grant select on table public.contributor_social_links to anon, authenticated;
grant insert, update, delete on table public.contributor_social_links to authenticated;
grant select, insert, update, delete on table public.look_curation_items to authenticated;
grant select, insert, delete on table public.look_likes to authenticated;

-- Active Curators may upload only their own profile avatar or Look cover. The
-- bucket is public for viewing, but object creation/replacement/deletion stays
-- restricted to a path containing the authenticated Curator UUID.
drop policy if exists "Active Curators select own COMOOTD media" on storage.objects;
create policy "Active Curators select own COMOOTD media"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'sisip-media'
    and (select private.is_own_comootd_curator_media_path(name))
  );

drop policy if exists "Active Curators upload own COMOOTD media" on storage.objects;
create policy "Active Curators upload own COMOOTD media"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'sisip-media'
    and (select private.is_own_comootd_curator_media_path(name))
  );

drop policy if exists "Active Curators update own COMOOTD media" on storage.objects;
create policy "Active Curators update own COMOOTD media"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'sisip-media'
    and (select private.is_own_comootd_curator_media_path(name))
  )
  with check (
    bucket_id = 'sisip-media'
    and (select private.is_own_comootd_curator_media_path(name))
  );

drop policy if exists "Active Curators delete own COMOOTD media" on storage.objects;
create policy "Active Curators delete own COMOOTD media"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'sisip-media'
    and (select private.is_own_comootd_curator_media_path(name))
  );
