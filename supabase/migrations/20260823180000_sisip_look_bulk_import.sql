-- Safe, repeatable bulk import for SISIP looks.
-- A single RPC keeps replacing the 2-5 look items atomic, so a retry can
-- never leave a published look with a partial set of products.

alter table public.looks
  add column if not exists import_key text;

alter table public.looks
  drop constraint if exists looks_import_key_format_check;

alter table public.looks
  add constraint looks_import_key_format_check
  check (import_key is null or import_key ~ '^[A-Z0-9][A-Z0-9_-]{0,79}$');

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.looks'::regclass
      and conname = 'looks_import_key_key'
  ) then
    alter table public.looks
      add constraint looks_import_key_key unique (import_key);
  end if;
end;
$$;

create or replace function public.import_sisip_look(
  p_look_key text,
  p_title text,
  p_excerpt text,
  p_cover_image_path text,
  p_cover_alt_text text,
  p_tone text,
  p_gender_target text,
  p_style_tags text[],
  p_product_variant_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text := pg_catalog.upper(pg_catalog.btrim(p_look_key));
  v_title text := pg_catalog.btrim(p_title);
  v_excerpt text := nullif(pg_catalog.btrim(p_excerpt), '');
  v_cover_image_path text := nullif(pg_catalog.btrim(p_cover_image_path), '');
  v_cover_alt_text text := nullif(pg_catalog.btrim(p_cover_alt_text), '');
  v_tone text := pg_catalog.lower(pg_catalog.btrim(p_tone));
  v_gender_target text := pg_catalog.lower(pg_catalog.btrim(p_gender_target));
  v_style_tags text[] := array(
    select pg_catalog.btrim(tag)
    from pg_catalog.unnest(coalesce(p_style_tags, '{}'::text[])) as tag
    where pg_catalog.btrim(tag) <> ''
  );
  v_look_id uuid;
  v_count integer := coalesce(pg_catalog.cardinality(p_product_variant_ids), 0);
  v_distinct_count integer;
  v_available_count integer;
begin
  if not (select private.is_sisip_admin()) then
    raise exception 'Only the SISIP admin can import looks.' using errcode = '42501';
  end if;

  if v_key !~ '^[A-Z0-9][A-Z0-9_-]{0,79}$' then
    raise exception 'look_key is invalid.';
  end if;
  if pg_catalog.char_length(v_title) not between 1 and 160 then
    raise exception 'Nama look harus berisi 1 sampai 160 karakter.';
  end if;
  if v_excerpt is not null and pg_catalog.char_length(v_excerpt) > 500 then
    raise exception 'Excerpt maksimal 500 karakter.';
  end if;
  if v_cover_image_path is not null and v_cover_image_path !~ '^https://' then
    raise exception 'URL cover look harus memakai https://.';
  end if;
  if v_cover_image_path is not null and v_cover_alt_text is null then
    raise exception 'cover_alt_text wajib diisi saat cover_image_url dipakai.';
  end if;
  if v_cover_alt_text is not null and pg_catalog.char_length(v_cover_alt_text) > 240 then
    raise exception 'Deskripsi cover maksimal 240 karakter.';
  end if;
  if v_tone not in ('carbon', 'clay', 'mineral', 'olive', 'midnight') then
    raise exception 'tone belum sesuai pilihan SISIP.';
  end if;
  if v_gender_target not in ('pria', 'wanita', 'unisex') then
    raise exception 'gender_target harus pria, wanita, atau unisex.';
  end if;
  if coalesce(pg_catalog.cardinality(v_style_tags), 0) = 0 then
    raise exception 'Look memerlukan minimal satu tag style.';
  end if;
  if coalesce(pg_catalog.cardinality(v_style_tags), 0) > 12 then
    raise exception 'Look maksimal memiliki 12 tag style.';
  end if;
  if exists (
    select 1
    from pg_catalog.unnest(v_style_tags) as selected(tag)
    where selected.tag not in ('Clean', 'Casual', 'Formal', 'Streetwear', 'Modest', 'Sporty', 'Vintage', 'Korean-inspired', 'Workwear', 'Party')
  ) then
    raise exception 'Tag style belum sesuai pilihan SISIP.';
  end if;
  if v_count not between 2 and 5 then
    raise exception 'Satu look harus berisi 2 sampai 5 item.';
  end if;

  select pg_catalog.count(distinct selected.variant_id)
  into v_distinct_count
  from pg_catalog.unnest(p_product_variant_ids) as selected(variant_id);
  if v_distinct_count <> v_count then
    raise exception 'Satu varian produk tidak boleh dipakai dua kali pada look yang sama.';
  end if;

  select pg_catalog.count(*)
  into v_available_count
  from (
    select pv.id
    from public.product_variants as pv
    join public.products as p on p.id = pv.product_id
    where pv.id = any(p_product_variant_ids)
      and pv.is_active
      and p.status = 'published'
      and p.published_at <= now()
    for share of pv, p
  ) as active_variants;
  if v_available_count <> v_count then
    raise exception 'Salah satu varian produk tidak aktif atau belum published.';
  end if;

  select l.id
  into v_look_id
  from public.looks as l
  where l.import_key = v_key
  for update;

  if found then
    if exists (
      select 1
      from public.new_series_slots as slot
      where slot.look_id = v_look_id
    ) or exists (
      select 1 from public.article_ctas as c where c.look_id = v_look_id
    ) or exists (
      select 1 from public.outfit_request_recommendations as r where r.look_id = v_look_id
    ) then
      raise exception 'Look ini sudah dipakai New Series, artikel, atau request outfit. Lepaskan referensinya sebelum upload ulang.';
    end if;

    update public.looks
    set status = 'draft',
        published_at = null,
        title = v_title,
        excerpt = v_excerpt,
        cover_image_path = v_cover_image_path,
        cover_alt_text = v_cover_alt_text,
        tone = v_tone,
        gender_target = v_gender_target,
        style_tags = v_style_tags
    where id = v_look_id;

    delete from public.look_items where look_id = v_look_id;
  else
    insert into public.looks (
      slug,
      import_key,
      title,
      excerpt,
      cover_image_path,
      cover_alt_text,
      tone,
      gender_target,
      style_tags,
      status
    )
    values (
      'import-' || pg_catalog.lower(pg_catalog.replace(v_key, '_', '-')) || '-' || pg_catalog.substring(pg_catalog.md5(v_key), 1, 8),
      v_key,
      v_title,
      v_excerpt,
      v_cover_image_path,
      v_cover_alt_text,
      v_tone,
      v_gender_target,
      v_style_tags,
      'draft'
    )
    returning id into v_look_id;
  end if;

  insert into public.look_items (look_id, product_variant_id, position)
  select v_look_id, selected.variant_id, selected.position::smallint
  from pg_catalog.unnest(p_product_variant_ids) with ordinality as selected(variant_id, position)
  order by selected.position;

  update public.looks
  set status = 'published',
      published_at = now()
  where id = v_look_id;

  return v_look_id;
end;
$$;

revoke all on function public.import_sisip_look(text, text, text, text, text, text, text, text[], uuid[]) from public, anon, authenticated;
grant execute on function public.import_sisip_look(text, text, text, text, text, text, text, text[], uuid[]) to authenticated;
