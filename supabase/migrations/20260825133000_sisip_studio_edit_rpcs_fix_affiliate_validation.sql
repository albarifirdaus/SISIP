-- Correct the affiliate-link expression in the live edit RPC. This repeats the
-- product function body so fresh databases and the already-deployed project
-- receive the same, deterministic definition.

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
