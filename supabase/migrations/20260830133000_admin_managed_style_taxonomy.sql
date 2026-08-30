-- COMOOTD style vocabulary is owned by the admin and shared by every picker.
-- Renaming a tag also updates existing catalogue and preference arrays so
-- filters, member profiles, and Curator profiles never drift apart.

create or replace function public.ensure_comootd_style_tag(p_name text)
returns public.comootd_style_tags
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := pg_catalog.regexp_replace(pg_catalog.btrim(coalesce(p_name, '')), E'\s+', ' ', 'g');
  v_tag public.comootd_style_tags%rowtype;
begin
  if not (select private.is_sisip_admin()) then
    raise exception 'Hanya admin COMOOTD yang dapat menambahkan style.' using errcode = '42501';
  end if;
  if char_length(v_name) not between 1 and 48 or v_name ~ '[[:cntrl:]]' then
    raise exception 'Style harus berisi 1 sampai 48 karakter.';
  end if;

  insert into public.comootd_style_tags (name, is_active, is_explore_visible)
  values (v_name, true, false)
  on conflict (normalized_name) do update set is_active = true;

  select t.* into v_tag
  from public.comootd_style_tags as t
  where t.normalized_name = pg_catalog.lower(v_name);
  return v_tag;
end;
$$;

revoke all on function public.ensure_comootd_style_tag(text) from public, anon, authenticated;
grant execute on function public.ensure_comootd_style_tag(text) to authenticated;

create or replace function public.admin_update_comootd_style_tag(
  p_id uuid,
  p_name text,
  p_is_active boolean default true,
  p_is_explore_visible boolean default false,
  p_sort_order integer default 0
)
returns public.comootd_style_tags
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.comootd_style_tags%rowtype;
  v_tag public.comootd_style_tags%rowtype;
  v_name text := pg_catalog.regexp_replace(pg_catalog.btrim(coalesce(p_name, '')), E'\s+', ' ', 'g');
begin
  if not (select private.is_sisip_admin()) then
    raise exception 'Hanya admin COMOOTD yang dapat mengubah style.' using errcode = '42501';
  end if;
  if char_length(v_name) not between 1 and 48 or v_name ~ '[[:cntrl:]]' then
    raise exception 'Style harus berisi 1 sampai 48 karakter.';
  end if;
  if coalesce(p_sort_order, 0) not between 0 and 1000 then
    raise exception 'Urutan style harus berada di antara 0 dan 1000.';
  end if;

  select t.* into v_old from public.comootd_style_tags as t where t.id = p_id for update;
  if not found then raise exception 'Style tidak ditemukan.'; end if;

  update public.comootd_style_tags
  set name = v_name,
      is_active = coalesce(p_is_active, true),
      is_explore_visible = coalesce(p_is_active, true) and coalesce(p_is_explore_visible, false),
      sort_order = coalesce(p_sort_order, 0)
  where id = p_id
  returning * into v_tag;

  if v_old.name is distinct from v_tag.name then
    update public.looks as target set style_tags = (
      select coalesce(pg_catalog.array_agg(case when pg_catalog.lower(item.value) = pg_catalog.lower(v_old.name) then v_tag.name else item.value end order by item.position), array[]::text[])
      from pg_catalog.unnest(coalesce(target.style_tags, array[]::text[])) with ordinality as item(value, position)
    ) where exists (select 1 from pg_catalog.unnest(coalesce(target.style_tags, array[]::text[])) as item(value) where pg_catalog.lower(item.value) = pg_catalog.lower(v_old.name));

    update public.products as target set style_tags = (
      select coalesce(pg_catalog.array_agg(case when pg_catalog.lower(item.value) = pg_catalog.lower(v_old.name) then v_tag.name else item.value end order by item.position), array[]::text[])
      from pg_catalog.unnest(coalesce(target.style_tags, array[]::text[])) with ordinality as item(value, position)
    ) where exists (select 1 from pg_catalog.unnest(coalesce(target.style_tags, array[]::text[])) as item(value) where pg_catalog.lower(item.value) = pg_catalog.lower(v_old.name));

    update public.articles as target set style_tags = (
      select coalesce(pg_catalog.array_agg(case when pg_catalog.lower(item.value) = pg_catalog.lower(v_old.name) then v_tag.name else item.value end order by item.position), array[]::text[])
      from pg_catalog.unnest(coalesce(target.style_tags, array[]::text[])) with ordinality as item(value, position)
    ) where exists (select 1 from pg_catalog.unnest(coalesce(target.style_tags, array[]::text[])) as item(value) where pg_catalog.lower(item.value) = pg_catalog.lower(v_old.name));

    update public.user_preferences as target set style_tags = (
      select coalesce(pg_catalog.array_agg(case when pg_catalog.lower(item.value) = pg_catalog.lower(v_old.name) then pg_catalog.lower(v_tag.name) else item.value end order by item.position), array[]::text[])
      from pg_catalog.unnest(coalesce(target.style_tags, array[]::text[])) with ordinality as item(value, position)
    ) where exists (select 1 from pg_catalog.unnest(coalesce(target.style_tags, array[]::text[])) as item(value) where pg_catalog.lower(item.value) = pg_catalog.lower(v_old.name));

    update public.outfit_requests as target set style_tags = (
      select coalesce(pg_catalog.array_agg(case when pg_catalog.lower(item.value) = pg_catalog.lower(v_old.name) then pg_catalog.lower(v_tag.name) else item.value end order by item.position), array[]::text[])
      from pg_catalog.unnest(coalesce(target.style_tags, array[]::text[])) with ordinality as item(value, position)
    ) where exists (select 1 from pg_catalog.unnest(coalesce(target.style_tags, array[]::text[])) as item(value) where pg_catalog.lower(item.value) = pg_catalog.lower(v_old.name));

    update public.curator_profiles as target set job_tags = (
      select coalesce(pg_catalog.array_agg(case when pg_catalog.lower(item.value) = pg_catalog.lower(v_old.name) then v_tag.name else item.value end order by item.position), array[]::text[])
      from pg_catalog.unnest(coalesce(target.job_tags, array[]::text[])) with ordinality as item(value, position)
    ) where exists (select 1 from pg_catalog.unnest(coalesce(target.job_tags, array[]::text[])) as item(value) where pg_catalog.lower(item.value) = pg_catalog.lower(v_old.name));
  end if;

  return v_tag;
end;
$$;

revoke all on function public.admin_update_comootd_style_tag(uuid, text, boolean, boolean, integer) from public, anon, authenticated;
grant execute on function public.admin_update_comootd_style_tag(uuid, text, boolean, boolean, integer) to authenticated;

