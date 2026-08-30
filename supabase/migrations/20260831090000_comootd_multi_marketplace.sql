-- Milestone 3: first-class marketplace metadata for Shopee and TikTok Shop.
-- The database derives the platform from a strict host allow-list; clients can
-- never label an arbitrary URL as a supported marketplace.

create or replace function private.comootd_marketplace_for_url(p_url text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when pg_catalog.lower(pg_catalog.btrim(coalesce(p_url, ''))) ~ E'^https://(([a-z0-9-]+\\.)*shopee\\.co\\.id|shope\\.ee)(/|$)' then 'shopee'
    when pg_catalog.lower(pg_catalog.btrim(coalesce(p_url, ''))) ~ E'^https://(([a-z0-9-]+\\.)*tiktok\\.com)(/|$)' then 'tiktok_shop'
    else null
  end
$$;

revoke all on function private.comootd_marketplace_for_url(text) from public;

alter table public.products drop constraint if exists products_affiliate_platform_check;
alter table public.products drop constraint if exists products_affiliate_url_check;
alter table public.products
  add constraint products_affiliate_platform_check
    check (affiliate_platform in ('shopee', 'tiktok_shop')),
  add constraint products_affiliate_url_marketplace_check
    check (affiliate_platform = private.comootd_marketplace_for_url(affiliate_url));

alter table public.look_curation_items
  add column if not exists affiliate_platform text not null default 'shopee';
alter table public.look_curation_items drop constraint if exists look_curation_items_affiliate_url_check;
alter table public.look_curation_items
  add constraint look_curation_items_affiliate_platform_check
    check (affiliate_platform in ('shopee', 'tiktok_shop')),
  add constraint look_curation_items_affiliate_url_marketplace_check
    check (affiliate_platform = private.comootd_marketplace_for_url(affiliate_url));

create or replace function private.set_comootd_affiliate_platform()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.affiliate_platform := private.comootd_marketplace_for_url(new.affiliate_url);
  if new.affiliate_platform is null then
    raise exception 'Gunakan link affiliate Shopee atau TikTok Shop yang valid.';
  end if;
  return new;
end;
$$;

revoke all on function private.set_comootd_affiliate_platform() from public;

drop trigger if exists products_set_affiliate_platform on public.products;
create trigger products_set_affiliate_platform
  before insert or update of affiliate_url on public.products
  for each row execute function private.set_comootd_affiliate_platform();

drop trigger if exists look_curation_items_set_affiliate_platform on public.look_curation_items;
create trigger look_curation_items_set_affiliate_platform
  before insert or update of affiliate_url on public.look_curation_items
  for each row execute function private.set_comootd_affiliate_platform();

-- Compatibility wrappers keep the established Shopee-only RPCs unchanged.
-- TikTok URLs are swapped in after the legacy operation, inside the same
-- database transaction, so public readers never observe a placeholder link.
create or replace function public.update_comootd_product(
  p_product_id uuid, p_title text, p_affiliate_url text, p_affiliate_platform text,
  p_price_idr integer, p_badges text[], p_style_tags text[], p_gender_target text,
  p_cover_image_path text, p_variants jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing_url text;
  v_platform text := private.comootd_marketplace_for_url(p_affiliate_url);
  v_result uuid;
begin
  if not (select private.is_sisip_admin()) then
    raise exception 'Only the COMOOTD admin can edit products.' using errcode='42501';
  end if;
  if v_platform is null or v_platform <> pg_catalog.btrim(coalesce(p_affiliate_platform, '')) then
    raise exception 'Link tidak sesuai marketplace yang dipilih.';
  end if;
  select affiliate_url into v_existing_url from public.products where id=p_product_id for update;
  if not found then raise exception 'Produk yang akan diedit sudah tidak tersedia.'; end if;
  v_result := public.update_sisip_product(
    p_product_id, p_title,
    case when v_platform='shopee' then p_affiliate_url else 'https://shopee.co.id/' end,
    p_price_idr, p_badges, p_style_tags, p_gender_target, p_cover_image_path, p_variants
  );
  update public.products set affiliate_url=p_affiliate_url where id=p_product_id;
  return v_result;
end;
$$;

revoke all on function public.update_comootd_product(uuid,text,text,text,integer,text[],text[],text,text,jsonb) from public, anon, authenticated;
grant execute on function public.update_comootd_product(uuid,text,text,text,integer,text[],text[],text,text,jsonb) to authenticated;

create or replace function public.save_contributor_look_v2(
  p_look_id uuid, p_title text, p_excerpt text, p_cover_image_path text,
  p_cover_alt_text text, p_gender_target text, p_style_tags text[], p_tone text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_legacy_items jsonb;
  v_result uuid;
begin
  if p_items is null or pg_catalog.jsonb_typeof(p_items) <> 'array' then
    raise exception 'Item kurasi Look belum valid.';
  end if;
  if exists (
    select 1 from pg_catalog.jsonb_array_elements(p_items) as supplied(value)
    where private.comootd_marketplace_for_url(supplied.value->>'affiliate_url') is null
      or pg_catalog.btrim(coalesce(supplied.value->>'affiliate_platform',''))
        <> private.comootd_marketplace_for_url(supplied.value->>'affiliate_url')
  ) then raise exception 'Pastikan link sesuai marketplace yang dipilih.'; end if;

  select pg_catalog.jsonb_agg(
    case when private.comootd_marketplace_for_url(item.value->>'affiliate_url')='shopee'
      then item.value
      else pg_catalog.jsonb_set(item.value, '{affiliate_url}', pg_catalog.to_jsonb('https://shopee.co.id/'::text))
    end order by item.position
  ) into v_legacy_items
  from pg_catalog.jsonb_array_elements(p_items) with ordinality as item(value,position);

  v_result := public.save_contributor_look(
    p_look_id,p_title,p_excerpt,p_cover_image_path,p_cover_alt_text,
    p_gender_target,p_style_tags,p_tone,v_legacy_items
  );

  update public.look_curation_items as target
  set affiliate_url=source.value->>'affiliate_url'
  from pg_catalog.jsonb_array_elements(p_items) with ordinality as source(value,position)
  where target.look_id=v_result and target.position=source.position::smallint;
  return v_result;
end;
$$;

revoke all on function public.save_contributor_look_v2(uuid,text,text,text,text,text,text[],text,jsonb) from public, anon, authenticated;
grant execute on function public.save_contributor_look_v2(uuid,text,text,text,text,text,text[],text,jsonb) to authenticated;

create or replace function public.resolve_comootd_link_report(p_report_id uuid,p_action text,p_replacement_url text default null)
returns void language plpgsql security definer set search_path='' as $$
declare
  r public.comootd_link_reports%rowtype;
  v_admin boolean := (select private.is_sisip_admin());
  v_current_platform text;
  v_replacement_platform text;
begin
  select * into r from public.comootd_link_reports where id=p_report_id for update;
  if not found or (not v_admin and r.owner_id is distinct from (select auth.uid())) then raise exception 'Laporan tidak tersedia.' using errcode='42501'; end if;
  if p_action not in ('resolved','dismissed','disabled','updated') then raise exception 'Tindakan tidak valid.'; end if;
  if r.target_type='product' then select affiliate_platform into v_current_platform from public.products where id=r.target_id;
  else select affiliate_platform into v_current_platform from public.look_curation_items where id=r.target_id; end if;
  if p_action='updated' then
    v_replacement_platform := private.comootd_marketplace_for_url(p_replacement_url);
    if v_replacement_platform is null then raise exception 'Gunakan tautan Shopee atau TikTok Shop yang valid.'; end if;
    if v_replacement_platform <> v_current_platform then raise exception 'Link pengganti harus berasal dari marketplace yang sama.'; end if;
  end if;
  if r.target_type='product' then
    update public.products set affiliate_url=case when p_action='updated' then p_replacement_url else affiliate_url end,link_status=case when p_action='disabled' then 'disabled' else 'active' end,is_available=case when p_action='disabled' then false else true end where id=r.target_id;
  else
    update public.look_curation_items set affiliate_url=case when p_action='updated' then p_replacement_url else affiliate_url end,link_status=case when p_action='disabled' then 'disabled' else 'active' end where id=r.target_id;
  end if;
  update public.comootd_link_reports set status=case when p_action='updated' then 'resolved' else p_action end,updated_at=now(),resolved_at=now(),resolved_by=(select auth.uid()) where id=p_report_id;
end; $$;

revoke all on function public.resolve_comootd_link_report(uuid,text,text) from public,anon,authenticated;
grant execute on function public.resolve_comootd_link_report(uuid,text,text) to authenticated;

comment on column public.products.affiliate_platform is 'Derived marketplace: shopee or tiktok_shop.';
comment on column public.look_curation_items.affiliate_platform is 'Derived marketplace for the curator-owned affiliate URL.';
