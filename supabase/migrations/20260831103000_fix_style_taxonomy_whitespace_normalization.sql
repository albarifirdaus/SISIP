-- PostgreSQL escape-string shorthand can collapse the intended whitespace
-- matcher into the literal pattern s+.
-- Use the POSIX whitespace class so saving a style never removes lowercase s.

create or replace function public.ensure_comootd_style_tag(p_name text)
returns public.comootd_style_tags
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := pg_catalog.regexp_replace(
    pg_catalog.btrim(coalesce(p_name, '')),
    '[[:space:]]+',
    ' ',
    'g'
  );
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
  v_name text := pg_catalog.regexp_replace(
    pg_catalog.btrim(coalesce(p_name, '')),
    '[[:space:]]+',
    ' ',
    'g'
  );
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

-- Repair names already persisted by the broken pattern. The loop also merges
-- the accidental "Ca ual" duplicate into the canonical "Casual" row.
do $$
declare
  repair record;
  old_tag public.comootd_style_tags%rowtype;
  canonical_tag public.comootd_style_tags%rowtype;
begin
  for repair in
    select * from (values
      ('Athlei ure', 'Athleisure'),
      ('Ba ic', 'Basic'),
      ('Ca ual', 'Casual'),
      ('Minimali t', 'Minimalist'),
      ('Mode t Ca ual', 'Modest Casual'),
      ('Mode t Formal', 'Modest Formal'),
      ('Japane e', 'Japanese')
    ) as repairs(old_name, new_name)
  loop
    select * into old_tag
    from public.comootd_style_tags
    where normalized_name = pg_catalog.lower(repair.old_name)
    for update;

    if not found then
      continue;
    end if;

    select * into canonical_tag
    from public.comootd_style_tags
    where normalized_name = pg_catalog.lower(repair.new_name)
      and id <> old_tag.id
    for update;

    update public.looks as target set style_tags = (
      select coalesce(pg_catalog.array_agg(case when pg_catalog.lower(item.value) = pg_catalog.lower(repair.old_name) then repair.new_name else item.value end order by item.position), array[]::text[])
      from pg_catalog.unnest(coalesce(target.style_tags, array[]::text[])) with ordinality as item(value, position)
    ) where exists (select 1 from pg_catalog.unnest(coalesce(target.style_tags, array[]::text[])) as item(value) where pg_catalog.lower(item.value) = pg_catalog.lower(repair.old_name));

    update public.products as target set style_tags = (
      select coalesce(pg_catalog.array_agg(case when pg_catalog.lower(item.value) = pg_catalog.lower(repair.old_name) then repair.new_name else item.value end order by item.position), array[]::text[])
      from pg_catalog.unnest(coalesce(target.style_tags, array[]::text[])) with ordinality as item(value, position)
    ) where exists (select 1 from pg_catalog.unnest(coalesce(target.style_tags, array[]::text[])) as item(value) where pg_catalog.lower(item.value) = pg_catalog.lower(repair.old_name));

    update public.articles as target set style_tags = (
      select coalesce(pg_catalog.array_agg(case when pg_catalog.lower(item.value) = pg_catalog.lower(repair.old_name) then repair.new_name else item.value end order by item.position), array[]::text[])
      from pg_catalog.unnest(coalesce(target.style_tags, array[]::text[])) with ordinality as item(value, position)
    ) where exists (select 1 from pg_catalog.unnest(coalesce(target.style_tags, array[]::text[])) as item(value) where pg_catalog.lower(item.value) = pg_catalog.lower(repair.old_name));

    update public.user_preferences as target set style_tags = (
      select coalesce(pg_catalog.array_agg(case when pg_catalog.lower(item.value) = pg_catalog.lower(repair.old_name) then pg_catalog.lower(repair.new_name) else item.value end order by item.position), array[]::text[])
      from pg_catalog.unnest(coalesce(target.style_tags, array[]::text[])) with ordinality as item(value, position)
    ) where exists (select 1 from pg_catalog.unnest(coalesce(target.style_tags, array[]::text[])) as item(value) where pg_catalog.lower(item.value) = pg_catalog.lower(repair.old_name));

    update public.outfit_requests as target set style_tags = (
      select coalesce(pg_catalog.array_agg(case when pg_catalog.lower(item.value) = pg_catalog.lower(repair.old_name) then pg_catalog.lower(repair.new_name) else item.value end order by item.position), array[]::text[])
      from pg_catalog.unnest(coalesce(target.style_tags, array[]::text[])) with ordinality as item(value, position)
    ) where exists (select 1 from pg_catalog.unnest(coalesce(target.style_tags, array[]::text[])) as item(value) where pg_catalog.lower(item.value) = pg_catalog.lower(repair.old_name));

    update public.curator_profiles as target set job_tags = (
      select coalesce(pg_catalog.array_agg(case when pg_catalog.lower(item.value) = pg_catalog.lower(repair.old_name) then repair.new_name else item.value end order by item.position), array[]::text[])
      from pg_catalog.unnest(coalesce(target.job_tags, array[]::text[])) with ordinality as item(value, position)
    ) where exists (select 1 from pg_catalog.unnest(coalesce(target.job_tags, array[]::text[])) as item(value) where pg_catalog.lower(item.value) = pg_catalog.lower(repair.old_name));

    if canonical_tag.id is not null then
      delete from public.comootd_style_tags where id = old_tag.id;
    else
      update public.comootd_style_tags set name = repair.new_name where id = old_tag.id;
    end if;
  end loop;
end;
$$;
