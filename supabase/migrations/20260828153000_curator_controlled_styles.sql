-- Curators may select active COMOOTD styles, but only admins may create them.

create or replace function public.ensure_comootd_style_tag(p_name text)
returns public.comootd_style_tags
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := pg_catalog.regexp_replace(pg_catalog.btrim(coalesce(p_name, '')), E'\\s+', ' ', 'g');
  v_tag public.comootd_style_tags%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Masuk terlebih dahulu untuk menambahkan tag style.' using errcode = '42501';
  end if;
  if not (select private.is_sisip_admin()) then
    raise exception 'Hanya admin COMOOTD yang dapat membuat tag style baru.' using errcode = '42501';
  end if;
  if char_length(v_name) not between 1 and 48 or v_name ~ '[[:cntrl:]]' then
    raise exception 'Tag style harus berisi 1 sampai 48 karakter.';
  end if;

  insert into public.comootd_style_tags (name,is_active,is_explore_visible)
  values (v_name,true,false)
  on conflict (normalized_name) do nothing;

  select t.* into v_tag
  from public.comootd_style_tags as t
  where t.normalized_name = pg_catalog.lower(v_name);
  if not found then raise exception 'Tag style tidak dapat disimpan.'; end if;
  return v_tag;
end;
$$;

revoke all on function public.ensure_comootd_style_tag(text) from public, anon, authenticated;
grant execute on function public.ensure_comootd_style_tag(text) to authenticated;

create or replace function public.validate_curator_controlled_styles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.creator_id = (select auth.uid()) and not (select private.is_sisip_admin()) then
    if exists (
      select 1
      from pg_catalog.unnest(coalesce(new.style_tags, array[]::text[])) as supplied(name)
      where not exists (
        select 1 from public.comootd_style_tags as tag
        where tag.is_active and tag.normalized_name = pg_catalog.lower(pg_catalog.btrim(supplied.name))
      )
    ) then
      raise exception 'Pilih tag style resmi COMOOTD.' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.validate_curator_controlled_styles() from public, anon, authenticated;
drop trigger if exists curator_looks_require_controlled_styles on public.looks;
create trigger curator_looks_require_controlled_styles
before insert or update of style_tags on public.looks
for each row execute procedure public.validate_curator_controlled_styles();
