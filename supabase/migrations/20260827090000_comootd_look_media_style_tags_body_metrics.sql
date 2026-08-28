-- COMOOTD media gallery, shared style taxonomy, and opt-in Curator body metrics.
--
-- This migration is additive. Existing `looks.cover_image_path` values are
-- preserved as the first ordered gallery image, and legacy look/product style
-- arrays remain compatible with the new taxonomy.

-- -----------------------------------------------------------------------------
-- Ordered Look gallery (one to three images)
-- -----------------------------------------------------------------------------

create table if not exists public.look_media (
  id uuid primary key default gen_random_uuid(),
  look_id uuid not null references public.looks(id) on delete cascade,
  image_path text not null
    check (char_length(btrim(image_path)) between 1 and 512),
  alt_text text
    check (alt_text is null or char_length(btrim(alt_text)) between 1 and 250),
  position smallint not null check (position between 1 and 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint look_media_look_position_key
    unique (look_id, position),
  constraint look_media_look_image_path_key unique (look_id, image_path)
);

create index if not exists look_media_look_position_idx
  on public.look_media (look_id, position);

drop trigger if exists look_media_set_updated_at on public.look_media;
create trigger look_media_set_updated_at
  before update on public.look_media
  for each row execute procedure public.set_updated_at();

-- Keep every existing cover as the first gallery image. A repeat run never
-- overwrites an already-curated first image.
insert into public.look_media (look_id, image_path, alt_text, position)
select
  l.id,
  btrim(l.cover_image_path),
  nullif(btrim(l.cover_alt_text), ''),
  1
from public.looks as l
where nullif(btrim(l.cover_image_path), '') is not null
on conflict do nothing;

-- Gallery writes deliberately go through this narrow RPC instead of direct
-- table mutation. It protects the 1--3 order, verifies media ownership, and
-- keeps legacy cover fields in sync for existing cards, share pages, and SEO.
create or replace function public.replace_comootd_look_media(
  p_look_id uuid,
  p_media jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_creator_id uuid;
  v_is_admin boolean := (select private.is_sisip_admin());
  v_media_count integer;
  v_distinct_path_count integer;
  v_first_image_path text;
  v_first_alt_text text;
begin
  if v_actor_id is null then
    raise exception 'Masuk terlebih dahulu untuk mengatur foto Look.' using errcode = '42501';
  end if;

  if p_look_id is null then
    raise exception 'Look yang akan diatur belum ditemukan.';
  end if;

  if p_media is null or pg_catalog.jsonb_typeof(p_media) <> 'array' then
    raise exception 'Daftar foto Look belum valid.';
  end if;

  select l.creator_id
  into v_creator_id
  from public.looks as l
  where l.id = p_look_id
  for update;

  if not found then
    raise exception 'Simpan Look terlebih dahulu sebelum menambahkan foto.';
  end if;

  if not v_is_admin and (
    v_creator_id <> v_actor_id
    or not (select private.is_active_comootd_curator())
  ) then
    raise exception 'Look ini bukan milik akun Curator Anda.' using errcode = '42501';
  end if;

  select count(*) into v_media_count
  from pg_catalog.jsonb_array_elements(p_media);

  if v_media_count > 3 then
    raise exception 'Satu Look maksimal memiliki 3 foto.';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_media) as supplied(value)
    where pg_catalog.jsonb_typeof(supplied.value) is distinct from 'object'
      or char_length(pg_catalog.btrim(coalesce(supplied.value ->> 'image_path', ''))) not between 1 and 512
      or (
        nullif(pg_catalog.btrim(coalesce(supplied.value ->> 'alt_text', '')), '') is not null
        and char_length(pg_catalog.btrim(supplied.value ->> 'alt_text')) > 250
      )
      or (
        not v_is_admin
        and pg_catalog.btrim(supplied.value ->> 'image_path') !~ (
          '^curators/' || v_actor_id::text || '/looks/' || p_look_id::text || '/[^/]+$'
        )
      )
      or (
        v_is_admin
        and pg_catalog.btrim(supplied.value ->> 'image_path') !~ '^https://'
        and pg_catalog.btrim(supplied.value ->> 'image_path') !~ (
          '^looks/' || p_look_id::text || '/[^/]+$'
        )
        and pg_catalog.btrim(supplied.value ->> 'image_path') !~ (
          '^curators/' || v_creator_id::text || '/looks/' || p_look_id::text || '/[^/]+$'
        )
      )
  ) then
    raise exception 'Salah satu foto Look atau teks alternatifnya belum valid.';
  end if;

  select count(distinct pg_catalog.btrim(supplied.value ->> 'image_path'))
  into v_distinct_path_count
  from pg_catalog.jsonb_array_elements(p_media) as supplied(value);

  if v_distinct_path_count <> v_media_count then
    raise exception 'Foto yang sama tidak dapat dipakai lebih dari sekali pada Look.';
  end if;

  select
    pg_catalog.btrim(supplied.value ->> 'image_path'),
    nullif(pg_catalog.btrim(coalesce(supplied.value ->> 'alt_text', '')), '')
  into v_first_image_path, v_first_alt_text
  from pg_catalog.jsonb_array_elements(p_media) with ordinality as supplied(value, position)
  order by supplied.position
  limit 1;

  delete from public.look_media
  where look_id = p_look_id;

  insert into public.look_media (look_id, image_path, alt_text, position)
  select
    p_look_id,
    pg_catalog.btrim(supplied.value ->> 'image_path'),
    nullif(pg_catalog.btrim(coalesce(supplied.value ->> 'alt_text', '')), ''),
    supplied.position::smallint
  from pg_catalog.jsonb_array_elements(p_media) with ordinality as supplied(value, position)
  order by supplied.position;

  update public.looks
  set cover_image_path = v_first_image_path,
      cover_alt_text = v_first_alt_text
  where id = p_look_id;

  return p_look_id;
end;
$$;

revoke all on function public.replace_comootd_look_media(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.replace_comootd_look_media(uuid, jsonb)
  to authenticated;

alter table public.look_media enable row level security;

drop policy if exists "Public reads media for published Looks" on public.look_media;
create policy "Public reads media for published Looks"
  on public.look_media for select
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

drop policy if exists "Curators read own Look media" on public.look_media;
create policy "Curators read own Look media"
  on public.look_media for select
  to authenticated
  using (
    exists (
      select 1
      from public.looks as l
      where l.id = look_id
        and l.creator_id = (select auth.uid())
        and (select private.is_active_comootd_curator())
    )
  );

drop policy if exists "COMOOTD admin manages Look media" on public.look_media;
create policy "COMOOTD admin manages Look media"
  on public.look_media for all
  to authenticated
  using ((select private.is_sisip_admin()))
  with check ((select private.is_sisip_admin()));

revoke all on table public.look_media from public, anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on table public.look_media to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Shared, normalized style taxonomy for Explore the Curation and Studio
-- -----------------------------------------------------------------------------

create table if not exists public.comootd_style_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null
    check (char_length(btrim(name)) between 1 and 48)
    check (name = pg_catalog.regexp_replace(pg_catalog.btrim(name), E'\\s+', ' ', 'g'))
    check (name !~ '[[:cntrl:]]'),
  normalized_name text generated always as (
    pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(name), E'\\s+', ' ', 'g'))
  ) stored,
  is_active boolean not null default true,
  is_explore_visible boolean not null default false,
  sort_order integer not null default 0 check (sort_order between 0 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint comootd_style_tags_normalized_name_key unique (normalized_name),
  constraint comootd_style_tags_explore_requires_active_check
    check (not is_explore_visible or is_active)
);

create index if not exists comootd_style_tags_explore_idx
  on public.comootd_style_tags (sort_order, name)
  where is_active and is_explore_visible;

drop trigger if exists comootd_style_tags_set_updated_at on public.comootd_style_tags;
create trigger comootd_style_tags_set_updated_at
  before update on public.comootd_style_tags
  for each row execute procedure public.set_updated_at();

-- Bring existing look/product/article style vocabulary into the picker. Tags
-- used by a published Look are shown in Explore by default; all seeded tags
-- remain active for Studio pickers.
with source_tags as (
  select
    pg_catalog.regexp_replace(pg_catalog.btrim(supplied.value), E'\\s+', ' ', 'g') as name,
    (l.status = 'published' and l.published_at <= now()) as is_explore_visible
  from public.looks as l
  cross join lateral pg_catalog.unnest(coalesce(l.style_tags, array[]::text[])) as supplied(value)

  union all

  select
    pg_catalog.regexp_replace(pg_catalog.btrim(supplied.value), E'\\s+', ' ', 'g') as name,
    false as is_explore_visible
  from public.products as p
  cross join lateral pg_catalog.unnest(coalesce(p.style_tags, array[]::text[])) as supplied(value)

  union all

  select
    pg_catalog.regexp_replace(pg_catalog.btrim(supplied.value), E'\\s+', ' ', 'g') as name,
    false as is_explore_visible
  from public.articles as a
  cross join lateral pg_catalog.unnest(coalesce(a.style_tags, array[]::text[])) as supplied(value)
),
canonical_tags as (
  select
    min(name) as name,
    bool_or(is_explore_visible) as is_explore_visible
  from source_tags
  where char_length(name) between 1 and 48
    and name !~ '[[:cntrl:]]'
  group by pg_catalog.lower(name)
)
insert into public.comootd_style_tags (name, is_active, is_explore_visible)
select name, true, is_explore_visible
from canonical_tags
on conflict (normalized_name) do nothing;

-- A Curator may add a tag in the same controlled picker used by the admin.
-- Curator-created tags are usable immediately in Studio, but only the admin
-- can surface them in the public Explore menu or deactivate existing tags.
create or replace function public.ensure_comootd_style_tag(p_name text)
returns public.comootd_style_tags
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_is_admin boolean := (select private.is_sisip_admin());
  v_name text := pg_catalog.regexp_replace(pg_catalog.btrim(coalesce(p_name, '')), E'\\s+', ' ', 'g');
  v_tag public.comootd_style_tags%rowtype;
begin
  if v_actor_id is null then
    raise exception 'Masuk terlebih dahulu untuk menambahkan tag style.' using errcode = '42501';
  end if;

  if not v_is_admin and not (select private.is_active_comootd_curator()) then
    raise exception 'Hanya Curator aktif atau admin yang dapat menambahkan tag style.' using errcode = '42501';
  end if;

  if char_length(v_name) not between 1 and 48 or v_name ~ '[[:cntrl:]]' then
    raise exception 'Tag style harus berisi 1 sampai 48 karakter.';
  end if;

  insert into public.comootd_style_tags (
    name,
    is_active,
    is_explore_visible
  ) values (
    v_name,
    true,
    false
  )
  on conflict (normalized_name) do nothing;

  select t.*
  into v_tag
  from public.comootd_style_tags as t
  where t.normalized_name = pg_catalog.lower(v_name);

  if not found then
    raise exception 'Tag style tidak dapat disimpan.';
  end if;

  if not v_tag.is_active and not v_is_admin then
    raise exception 'Tag style tersebut sedang tidak aktif.' using errcode = '42501';
  end if;

  return v_tag;
end;
$$;

revoke all on function public.ensure_comootd_style_tag(text)
  from public, anon, authenticated;
grant execute on function public.ensure_comootd_style_tag(text)
  to authenticated;

alter table public.comootd_style_tags enable row level security;

drop policy if exists "Public reads active COMOOTD style tags" on public.comootd_style_tags;
create policy "Public reads active COMOOTD style tags"
  on public.comootd_style_tags for select
  to anon, authenticated
  using (is_active);

drop policy if exists "COMOOTD admin manages style tags" on public.comootd_style_tags;
create policy "COMOOTD admin manages style tags"
  on public.comootd_style_tags for all
  to authenticated
  using ((select private.is_sisip_admin()))
  with check ((select private.is_sisip_admin()));

revoke all on table public.comootd_style_tags from public, anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on table public.comootd_style_tags to anon, authenticated;
grant insert, update, delete on table public.comootd_style_tags to authenticated;

-- -----------------------------------------------------------------------------
-- Optional body metrics kept outside public Curator profile rows for privacy
-- -----------------------------------------------------------------------------

create table if not exists public.curator_body_metrics (
  user_id uuid primary key references public.curator_profiles(user_id) on delete cascade,
  height_cm smallint
    check (height_cm is null or height_cm between 100 and 250),
  weight_kg numeric(5, 1)
    check (weight_kg is null or weight_kg between 20 and 300),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint curator_body_metrics_has_value_check
    check (height_cm is not null or weight_kg is not null)
);

drop trigger if exists curator_body_metrics_set_updated_at on public.curator_body_metrics;
create trigger curator_body_metrics_set_updated_at
  before update on public.curator_body_metrics
  for each row execute procedure public.set_updated_at();

alter table public.curator_body_metrics enable row level security;

-- The row itself is invisible to the public until its owner opts in. This is
-- intentionally a separate table rather than nullable columns on
-- `curator_profiles`, because RLS cannot hide individual columns conditionally.
drop policy if exists "Public reads opted-in Curator body metrics" on public.curator_body_metrics;
create policy "Public reads opted-in Curator body metrics"
  on public.curator_body_metrics for select
  to anon, authenticated
  using (
    is_public
    and exists (
      select 1
      from public.curator_profiles as cp
      where cp.user_id = curator_body_metrics.user_id
        and cp.is_active
    )
  );

drop policy if exists "Curators read own body metrics" on public.curator_body_metrics;
create policy "Curators read own body metrics"
  on public.curator_body_metrics for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Active Curators create own body metrics" on public.curator_body_metrics;
create policy "Active Curators create own body metrics"
  on public.curator_body_metrics for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and (select private.is_active_comootd_curator())
  );

drop policy if exists "Active Curators update own body metrics" on public.curator_body_metrics;
create policy "Active Curators update own body metrics"
  on public.curator_body_metrics for update
  to authenticated
  using (
    user_id = (select auth.uid())
    and (select private.is_active_comootd_curator())
  )
  with check (
    user_id = (select auth.uid())
    and (select private.is_active_comootd_curator())
  );

drop policy if exists "Curators delete own body metrics" on public.curator_body_metrics;
create policy "Curators delete own body metrics"
  on public.curator_body_metrics for delete
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "COMOOTD admin manages Curator body metrics" on public.curator_body_metrics;
create policy "COMOOTD admin manages Curator body metrics"
  on public.curator_body_metrics for all
  to authenticated
  using ((select private.is_sisip_admin()))
  with check ((select private.is_sisip_admin()));

revoke all on table public.curator_body_metrics from public, anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on table public.curator_body_metrics to anon, authenticated;
grant insert, update, delete on table public.curator_body_metrics to authenticated;
