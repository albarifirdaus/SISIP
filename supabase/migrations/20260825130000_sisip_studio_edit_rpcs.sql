-- Atomic Studio edits preserve the existing product/look IDs and every
-- relationship that points to them (New Series, Journal, and request outfit).

create or replace function public.update_sisip_look(
  p_look_id uuid,
  p_title text,
  p_gender_target text,
  p_style_tags text[],
  p_tone text,
  p_product_variant_ids uuid[],
  p_cover_image_path text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_look_id uuid;
  v_title text := pg_catalog.btrim(coalesce(p_title, ''));
  v_gender_target text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_gender_target, '')));
  v_tone text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_tone, '')));
  v_style_tags text[];
  v_cover_image_path text := nullif(pg_catalog.btrim(coalesce(p_cover_image_path, '')), '');
  v_item_count integer := coalesce(pg_catalog.cardinality(p_product_variant_ids), 0);
  v_distinct_item_count integer;
  v_available_count integer;
begin
  if not (select private.is_sisip_admin()) then
    raise exception 'Only the SISIP admin can edit looks.' using errcode = '42501';
  end if;

  if p_look_id is null then
    raise exception 'Look yang akan diedit belum ditemukan.';
  end if;

  select l.id
  into v_look_id
  from public.looks as l
  where l.id = p_look_id
  for update;

  if not found then
    raise exception 'Look yang akan diedit sudah tidak tersedia.';
  end if;

  if char_length(v_title) not between 1 and 160 then
    raise exception 'Nama look wajib berisi 1 sampai 160 karakter.';
  end if;

  if v_gender_target not in ('pria', 'wanita', 'unisex') then
    raise exception 'Gender look harus pria, wanita, atau unisex.';
  end if;

  if v_tone not in ('carbon', 'clay', 'mineral', 'olive', 'midnight') then
    raise exception 'Arah visual look belum sesuai pilihan COMOOTD.';
  end if;

  if coalesce(pg_catalog.cardinality(p_style_tags), 0) > 12 then
    raise exception 'Look maksimal memiliki 12 tag style.';
  end if;

  select coalesce(pg_catalog.array_agg(cleaned.tag order by cleaned.position), array[]::text[])
  into v_style_tags
  from (
    select pg_catalog.btrim(source.tag) as tag, source.position
    from pg_catalog.unnest(coalesce(p_style_tags, array[]::text[])) with ordinality as source(tag, position)
    where pg_catalog.btrim(source.tag) <> ''
  ) as cleaned;

  if coalesce(pg_catalog.cardinality(v_style_tags), 0) < 1
    or exists (
      select 1
      from pg_catalog.unnest(v_style_tags) as tag(value)
      where char_length(tag.value) > 80
    ) then
    raise exception 'Look memerlukan minimal satu tag style dengan panjang maksimal 80 karakter.';
  end if;

  if v_item_count < 2 or v_item_count > 5
    or exists (
      select 1
      from pg_catalog.unnest(p_product_variant_ids) as selected(variant_id)
      where selected.variant_id is null
    ) then
    raise exception 'Satu look harus berisi 2 sampai 5 varian produk.';
  end if;

  select count(distinct selected.variant_id)
  into v_distinct_item_count
  from pg_catalog.unnest(p_product_variant_ids) as selected(variant_id);

  if v_distinct_item_count <> v_item_count then
    raise exception 'Satu varian produk tidak boleh dipakai dua kali pada look yang sama.';
  end if;

  select count(*)
  into v_available_count
  from public.product_variants as pv
  join public.products as p on p.id = pv.product_id
  where pv.id = any(p_product_variant_ids)
    and pv.is_active
    and p.status = 'published'
    and p.published_at <= pg_catalog.now();

  if v_available_count <> v_item_count then
    raise exception 'Salah satu varian produk tidak aktif atau belum published.';
  end if;

  if v_cover_image_path is not null
    and v_cover_image_path !~ '^https://'
    and v_cover_image_path !~ ('^looks/' || p_look_id::text || '/') then
    raise exception 'Path foto cover look belum valid.';
  end if;

  update public.looks
  set title = v_title,
      gender_target = v_gender_target,
      style_tags = v_style_tags,
      tone = v_tone,
      cover_image_path = v_cover_image_path
  where id = v_look_id;

  -- This function runs in one transaction. The deferred validation trigger on
  -- look_items sees the complete replacement set at commit time, never a
  -- temporarily empty published look.
  delete from public.look_items
  where look_id = v_look_id;

  insert into public.look_items (look_id, product_variant_id, position)
  select v_look_id, selected.variant_id, selected.position::smallint
  from pg_catalog.unnest(p_product_variant_ids) with ordinality as selected(variant_id, position)
  order by selected.position;

  return v_look_id;
end;
$$;

revoke all on function public.update_sisip_look(uuid, text, text, text[], text, uuid[], text)
  from public, anon, authenticated;
grant execute on function public.update_sisip_look(uuid, text, text, text[], text, uuid[], text)
  to authenticated;


create or replace function public.update_sisip_product(
  p_product_id uuid,
  p_title text,
  p_affiliate_url text,
  p_price_idr integer,
  p_badges text[],
  p_style_tags text[],
  p_gender_target text,
  p_cover_image_path text,
  p_variants jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_product_id uuid;
  v_title text := pg_catalog.btrim(coalesce(p_title, ''));
  v_affiliate_url text := pg_catalog.btrim(coalesce(p_affiliate_url, ''));
  v_gender_target text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_gender_target, '')));
  v_badges text[];
  v_style_tags text[];
  v_cover_image_path text := nullif(pg_catalog.btrim(coalesce(p_cover_image_path, '')), '');
  v_variant_count integer;
  v_label_count integer;
  v_existing record;
  v_variant record;
begin
  if not (select private.is_sisip_admin()) then
    raise exception 'Only the SISIP admin can edit products.' using errcode = '42501';
  end if;

  if p_product_id is null then
    raise exception 'Produk yang akan diedit belum ditemukan.';
  end if;

  select p.id
  into v_product_id
  from public.products as p
  where p.id = p_product_id
  for update;

  if not found then
    raise exception 'Produk yang akan diedit sudah tidak tersedia.';
  end if;

  if char_length(v_title) not between 1 and 160 then
    raise exception 'Nama produk wajib berisi 1 sampai 160 karakter.';
  end if;

  if p_price_idr is null or p_price_idr <= 0 then
    raise exception 'Harga referensi harus berupa angka IDR yang lebih dari nol.';
  end if;

  if v_gender_target not in ('pria', 'wanita', 'unisex') then
    raise exception 'Gender produk harus pria, wanita, atau unisex.';
  end if;

  if v_affiliate_url !~ E'^https://([a-z0-9-]+\\.)*shopee\\.co\\.id(/|$)'
    and v_affiliate_url !~ E'^https://shope\\.ee(/|$)' then
    raise exception 'Gunakan link affiliate Shopee Indonesia yang diawali https://.';
  end if;

  if coalesce(pg_catalog.cardinality(p_badges), 0) > 12
    or coalesce(pg_catalog.cardinality(p_style_tags), 0) > 12 then
    raise exception 'Produk maksimal memiliki 12 badge dan 12 tag style.';
  end if;

  select coalesce(pg_catalog.array_agg(cleaned.tag order by cleaned.position), array[]::text[])
  into v_badges
  from (
    select pg_catalog.btrim(source.tag) as tag, source.position
    from pg_catalog.unnest(coalesce(p_badges, array[]::text[])) with ordinality as source(tag, position)
    where pg_catalog.btrim(source.tag) <> ''
  ) as cleaned;

  select coalesce(pg_catalog.array_agg(cleaned.tag order by cleaned.position), array[]::text[])
  into v_style_tags
  from (
    select pg_catalog.btrim(source.tag) as tag, source.position
    from pg_catalog.unnest(coalesce(p_style_tags, array[]::text[])) with ordinality as source(tag, position)
    where pg_catalog.btrim(source.tag) <> ''
  ) as cleaned;

  if exists (
    select 1
    from pg_catalog.unnest(v_badges || v_style_tags) as tag(value)
    where char_length(tag.value) > 80
  ) then
    raise exception 'Badge dan tag style maksimal 80 karakter.';
  end if;

  if p_variants is null or pg_catalog.jsonb_typeof(p_variants) <> 'array' then
    raise exception 'Varian warna belum valid.';
  end if;

  select count(*)
  into v_variant_count
  from pg_catalog.jsonb_array_elements(p_variants);

  if v_variant_count < 1 or v_variant_count > 30 then
    raise exception 'Produk harus memiliki 1 sampai 30 varian warna.';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_variants) as source(value)
    where pg_catalog.btrim(coalesce(source.value ->> 'label', '')) = ''
      or char_length(pg_catalog.btrim(coalesce(source.value ->> 'label', ''))) > 80
      or coalesce(source.value ->> 'color_hex', '') !~ '^#[0-9A-Fa-f]{6}$'
      or (
        nullif(pg_catalog.btrim(coalesce(source.value ->> 'image_path', '')), '') is not null
        and (source.value ->> 'image_path') !~ '^https://'
        and (source.value ->> 'image_path') !~ ('^products/' || p_product_id::text || '/')
      )
      or (
        nullif(pg_catalog.btrim(coalesce(source.value ->> 'id', '')), '') is not null
        and (source.value ->> 'id') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      )
  ) then
    raise exception 'Salah satu varian warna belum valid.';
  end if;

  select count(distinct pg_catalog.lower(pg_catalog.btrim(source.value ->> 'label')))
  into v_label_count
  from pg_catalog.jsonb_array_elements(p_variants) as source(value);

  if v_label_count <> v_variant_count then
    raise exception 'Nama varian warna tidak boleh berulang.';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_to_recordset(p_variants) as supplied(id uuid, label text, color_hex text, image_path text)
    where supplied.id is not null
      and not exists (
        select 1
        from public.product_variants as pv
        where pv.id = supplied.id
          and pv.product_id = p_product_id
      )
  ) then
    raise exception 'Salah satu varian warna tidak berasal dari produk ini.';
  end if;

  if exists (
    select 1
    from (
      select supplied.id
      from pg_catalog.jsonb_to_recordset(p_variants) as supplied(id uuid, label text, color_hex text, image_path text)
      where supplied.id is not null
      group by supplied.id
      having count(*) > 1
    ) as duplicate_ids
  ) then
    raise exception 'Satu varian warna tidak boleh dipilih dua kali.';
  end if;

  if v_cover_image_path is not null
    and v_cover_image_path !~ '^https://'
    and v_cover_image_path !~ ('^products/' || p_product_id::text || '/') then
    raise exception 'Path foto cover produk belum valid.';
  end if;

  -- An omitted active colour is only removable when no look points to it.
  for v_existing in
    select pv.id, pv.label
    from public.product_variants as pv
    where pv.product_id = p_product_id
      and pv.is_active
    for update
  loop
    if not exists (
      select 1
      from pg_catalog.jsonb_to_recordset(p_variants) as supplied(id uuid, label text, color_hex text, image_path text)
      where supplied.id = v_existing.id
    ) and exists (
      select 1
      from public.look_items as li
      where li.product_variant_id = v_existing.id
    ) then
      raise exception 'Varian warna "%" masih dipakai oleh look dan tidak dapat dihapus.', v_existing.label;
    end if;
  end loop;

  delete from public.product_variants as pv
  where pv.product_id = p_product_id
    and pv.is_active
    and not exists (
      select 1
      from pg_catalog.jsonb_to_recordset(p_variants) as supplied(id uuid, label text, color_hex text, image_path text)
      where supplied.id = pv.id
    );

  -- Use a temporary label so two existing colours can safely swap names.
  update public.product_variants as pv
  set label = 'tmp-' || pv.id::text
  where pv.product_id = p_product_id
    and exists (
      select 1
      from pg_catalog.jsonb_to_recordset(p_variants) as supplied(id uuid, label text, color_hex text, image_path text)
      where supplied.id = pv.id
    );

  update public.products
  set name = v_title,
      affiliate_url = v_affiliate_url,
      price_idr = p_price_idr,
      badges = v_badges,
      style_tags = v_style_tags,
      gender_target = v_gender_target,
      cover_image_path = v_cover_image_path,
      price_checked_at = pg_catalog.now()
  where id = v_product_id;

  for v_variant in
    select source.position,
           nullif(pg_catalog.btrim(coalesce(source.value ->> 'id', '')), '')::uuid as id,
           pg_catalog.btrim(source.value ->> 'label') as label,
           pg_catalog.upper(pg_catalog.btrim(source.value ->> 'color_hex')) as color_hex,
           nullif(pg_catalog.btrim(coalesce(source.value ->> 'image_path', '')), '') as image_path
    from pg_catalog.jsonb_array_elements(p_variants) with ordinality as source(value, position)
    order by source.position
  loop
    if v_variant.id is null then
      insert into public.product_variants (
        product_id,
        label,
        color_name,
        color_hex,
        image_path,
        is_active,
        sort_order
      ) values (
        v_product_id,
        v_variant.label,
        v_variant.label,
        v_variant.color_hex,
        coalesce(v_variant.image_path, v_cover_image_path),
        true,
        v_variant.position - 1
      );
    else
      update public.product_variants
      set label = v_variant.label,
          color_name = v_variant.label,
          color_hex = v_variant.color_hex,
          image_path = coalesce(v_variant.image_path, v_cover_image_path),
          is_active = true,
          sort_order = v_variant.position - 1
      where id = v_variant.id;
    end if;
  end loop;

  return v_product_id;
end;
$$;

revoke all on function public.update_sisip_product(uuid, text, text, integer, text[], text[], text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.update_sisip_product(uuid, text, text, integer, text[], text[], text, text, jsonb)
  to authenticated;
