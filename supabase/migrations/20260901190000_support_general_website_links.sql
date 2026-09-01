-- Stage 4: accept any valid HTTPS product destination while keeping Shopee
-- and TikTok Shop as first-class marketplace labels.
-- Created with `supabase migration new support_general_website_links`; the
-- version follows the repository's existing future-dated migration sequence.

create or replace function private.comootd_marketplace_for_url(p_url text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when pg_catalog.lower(pg_catalog.btrim(coalesce(p_url, ''))) ~ E'^https://(([a-z0-9-]+\\.)*shopee\\.co\\.id|shope\\.ee)(/|$)' then 'shopee'
    when pg_catalog.lower(pg_catalog.btrim(coalesce(p_url, ''))) ~ E'^https://(([a-z0-9-]+\\.)*tiktok\\.com)(/|$)' then 'tiktok_shop'
    when pg_catalog.lower(pg_catalog.btrim(coalesce(p_url, ''))) ~ E'^https://([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z0-9-]{2,63}(:[0-9]{1,5})?([/?#]|$)' then 'website'
    else null
  end
$$;

revoke all on function private.comootd_marketplace_for_url(text) from public, anon, authenticated;

alter table public.products
  drop constraint if exists products_affiliate_platform_check,
  drop constraint if exists products_affiliate_url_marketplace_check;
alter table public.products
  add constraint products_affiliate_platform_check
    check (affiliate_platform in ('shopee', 'tiktok_shop', 'website')),
  add constraint products_affiliate_url_marketplace_check
    check (affiliate_platform = private.comootd_marketplace_for_url(affiliate_url));

alter table public.look_curation_items
  drop constraint if exists look_curation_items_affiliate_platform_check,
  drop constraint if exists look_curation_items_affiliate_url_marketplace_check;
alter table public.look_curation_items
  add constraint look_curation_items_affiliate_platform_check
    check (affiliate_platform in ('shopee', 'tiktok_shop', 'website')),
  add constraint look_curation_items_affiliate_url_marketplace_check
    check (affiliate_platform = private.comootd_marketplace_for_url(affiliate_url));

alter table public.product_marketplace_links
  drop constraint if exists product_marketplace_links_marketplace_check,
  drop constraint if exists product_marketplace_links_url_check;
alter table public.product_marketplace_links
  add constraint product_marketplace_links_marketplace_check
    check (marketplace in ('shopee', 'tiktok_shop', 'website')),
  add constraint product_marketplace_links_url_check
    check (marketplace = private.comootd_marketplace_for_url(affiliate_url));

alter table public.curator_item_marketplace_links
  drop constraint if exists curator_item_marketplace_links_marketplace_check,
  drop constraint if exists curator_item_marketplace_links_url_check;
alter table public.curator_item_marketplace_links
  add constraint curator_item_marketplace_links_marketplace_check
    check (marketplace in ('shopee', 'tiktok_shop', 'website')),
  add constraint curator_item_marketplace_links_url_check
    check (marketplace = private.comootd_marketplace_for_url(affiliate_url));

alter table public.comootd_marketplace_link_history
  drop constraint if exists comootd_marketplace_link_history_marketplace_check;
alter table public.comootd_marketplace_link_history
  add constraint comootd_marketplace_link_history_marketplace_check
    check (marketplace in ('shopee', 'tiktok_shop', 'website'));

create or replace function private.set_comootd_affiliate_platform()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.affiliate_platform := private.comootd_marketplace_for_url(new.affiliate_url);
  if new.affiliate_platform is null then
    raise exception 'Gunakan link tujuan HTTPS yang valid.';
  end if;
  return new;
end;
$$;
revoke all on function private.set_comootd_affiliate_platform() from public, anon, authenticated;

create or replace function private.sync_product_marketplace_link()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  update public.product_marketplace_links set is_primary=false,updated_at=now()
  where product_id=new.id and marketplace<>new.affiliate_platform and is_primary;
  insert into public.product_marketplace_links(product_id,marketplace,affiliate_url,label,status,is_primary,created_by)
  values(new.id,new.affiliate_platform,new.affiliate_url,
    case new.affiliate_platform when 'tiktok_shop' then 'TikTok Shop' when 'website' then 'Website' else 'Shopee' end,
    new.link_status,true,(select auth.uid()))
  on conflict(product_id,marketplace) do update set
    affiliate_url=excluded.affiliate_url,label=excluded.label,status=excluded.status,is_primary=true,updated_at=now();
  return new;
end $$;
revoke all on function private.sync_product_marketplace_link() from public,anon,authenticated;

create or replace function private.sync_curator_item_marketplace_link()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_owner uuid;
begin
  select creator_id into v_owner from public.looks where id=new.look_id;
  update public.curator_item_marketplace_links set is_primary=false,updated_at=now()
  where curator_item_id=new.id and marketplace<>new.affiliate_platform and is_primary;
  insert into public.curator_item_marketplace_links(curator_item_id,marketplace,affiliate_url,label,status,is_primary,created_by)
  values(new.id,new.affiliate_platform,new.affiliate_url,
    case new.affiliate_platform when 'tiktok_shop' then 'TikTok Shop' when 'website' then 'Website' else 'Shopee' end,
    new.link_status,true,v_owner)
  on conflict(curator_item_id,marketplace) do update set
    affiliate_url=excluded.affiliate_url,label=excluded.label,status=excluded.status,is_primary=true,updated_at=now();
  return new;
end $$;
revoke all on function private.sync_curator_item_marketplace_link() from public,anon,authenticated;

create or replace function private.set_comootd_marketplace_links(
  p_target_type text,p_target_id uuid,p_links jsonb
)
returns void language plpgsql security definer set search_path='' as $$
declare
  v_actor uuid := (select auth.uid()); v_owner uuid; v_item jsonb; v_marketplace text;
  v_url text; v_label text; v_primary boolean; v_primary_count integer; v_id uuid;
  v_previous_url text; v_previous_status text; v_existed boolean; v_target_name text;
begin
  if v_actor is null then raise exception 'Masuk terlebih dahulu.' using errcode='42501'; end if;
  if p_target_type not in ('product','curator_item') or p_target_id is null then raise exception 'Target link tidak valid.'; end if;
  if jsonb_typeof(p_links)<>'array' or jsonb_array_length(p_links) not between 1 and 2 then
    raise exception 'Simpan satu atau dua link tujuan.';
  end if;
  select count(*) into v_primary_count from jsonb_array_elements(p_links) e where coalesce((e->>'is_primary')::boolean,false);
  if v_primary_count<>1 then raise exception 'Pilih tepat satu link utama.'; end if;
  if (select count(distinct e->>'marketplace') from jsonb_array_elements(p_links) e)<>jsonb_array_length(p_links) then
    raise exception 'Satu jenis platform hanya boleh dipakai sekali.';
  end if;

  if p_target_type='product' then
    if not (select private.is_sisip_admin()) then raise exception 'Akses admin diperlukan.' using errcode='42501'; end if;
    select name into v_target_name from public.products where id=p_target_id for update;
  else
    select l.creator_id,i.name into v_owner,v_target_name
    from public.look_curation_items i join public.looks l on l.id=i.look_id
    where i.id=p_target_id for update of i;
    if not found or (v_owner<>v_actor and not (select private.is_sisip_admin())) then
      raise exception 'Item Curator tidak tersedia.' using errcode='42501';
    end if;
  end if;
  if not found then raise exception 'Target link tidak tersedia.'; end if;

  if p_target_type='product' then
    update public.product_marketplace_links set is_primary=false,updated_at=now()
    where product_id=p_target_id and is_primary;
    update public.product_marketplace_links set status='disabled',updated_at=now()
    where product_id=p_target_id and marketplace not in (select e->>'marketplace' from jsonb_array_elements(p_links) e);
  else
    update public.curator_item_marketplace_links set is_primary=false,updated_at=now()
    where curator_item_id=p_target_id and is_primary;
    update public.curator_item_marketplace_links set status='disabled',updated_at=now()
    where curator_item_id=p_target_id and marketplace not in (select e->>'marketplace' from jsonb_array_elements(p_links) e);
  end if;

  for v_item in select value from jsonb_array_elements(p_links) loop
    v_marketplace:=btrim(coalesce(v_item->>'marketplace',''));
    v_url:=btrim(coalesce(v_item->>'affiliate_url',''));
    v_label:=nullif(left(btrim(coalesce(v_item->>'label','')),60),'');
    v_primary:=coalesce((v_item->>'is_primary')::boolean,false);
    if v_marketplace not in ('shopee','tiktok_shop','website') or private.comootd_marketplace_for_url(v_url) is distinct from v_marketplace then
      raise exception 'Pastikan setiap link sesuai dengan platform yang terdeteksi.';
    end if;
    if p_target_type='product' then
      select id,affiliate_url,status into v_id,v_previous_url,v_previous_status
      from public.product_marketplace_links where product_id=p_target_id and marketplace=v_marketplace;
      v_existed:=found;
      insert into public.product_marketplace_links(product_id,marketplace,affiliate_url,label,status,is_primary,created_by)
      values(p_target_id,v_marketplace,v_url,coalesce(v_label,case v_marketplace when 'tiktok_shop' then 'TikTok Shop' when 'website' then 'Website' else 'Shopee' end),'active',v_primary,v_actor)
      on conflict(product_id,marketplace) do update set affiliate_url=excluded.affiliate_url,label=excluded.label,status='active',is_primary=excluded.is_primary,updated_at=now()
      returning id into v_id;
    else
      select id,affiliate_url,status into v_id,v_previous_url,v_previous_status
      from public.curator_item_marketplace_links where curator_item_id=p_target_id and marketplace=v_marketplace;
      v_existed:=found;
      insert into public.curator_item_marketplace_links(curator_item_id,marketplace,affiliate_url,label,status,is_primary,created_by)
      values(p_target_id,v_marketplace,v_url,coalesce(v_label,case v_marketplace when 'tiktok_shop' then 'TikTok Shop' when 'website' then 'Website' else 'Shopee' end),'active',v_primary,v_actor)
      on conflict(curator_item_id,marketplace) do update set affiliate_url=excluded.affiliate_url,label=excluded.label,status='active',is_primary=excluded.is_primary,updated_at=now()
      returning id into v_id;
    end if;
    insert into public.comootd_marketplace_link_history(target_type,link_id,owner_id,actor_id,action,marketplace,previous_url,next_url)
    values(case when p_target_type='product' then 'product_link' else 'curator_link' end,v_id,v_owner,v_actor,
      case when not v_existed then 'added' when v_previous_url is distinct from v_url then 'updated' when v_previous_status='disabled' then 'activated' when v_primary then 'primary_changed' else 'updated' end,
      v_marketplace,v_previous_url,v_url);
    if v_primary then
      if p_target_type='product' then
        update public.products set affiliate_platform=v_marketplace,affiliate_url=v_url,link_status='active',is_available=true where id=p_target_id;
      else
        update public.look_curation_items set affiliate_platform=v_marketplace,affiliate_url=v_url,link_status='active' where id=p_target_id;
      end if;
    end if;
  end loop;
end $$;
revoke all on function private.set_comootd_marketplace_links(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function private.set_comootd_marketplace_links(text,uuid,jsonb) to authenticated;

create or replace function public.get_comootd_link_inventory(
  p_page integer default 1,
  p_page_size integer default 25,
  p_query text default '',
  p_status text default 'all',
  p_marketplace text default 'all'
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select
      greatest(coalesce(p_page, 1), 1) as page_number,
      least(greatest(coalesce(p_page_size, 25), 10), 50) as page_size,
      lower(btrim(coalesce(p_query, ''))) as query_text,
      case when p_status in ('active', 'reported', 'disabled') then p_status else 'all' end as status_filter,
      case when p_marketplace in ('shopee', 'tiktok_shop', 'website') then p_marketplace else 'all' end as marketplace_filter
  ),
  visible_links as (
    select ml.id,'product_link'::text as target_type,p.name::text as title,
      coalesce(p.slug,'Katalog produk')::text as context,ml.marketplace,ml.affiliate_url,
      ml.label,ml.status,ml.is_primary,ml.updated_at
    from public.product_marketplace_links ml
    join public.products p on p.id=ml.product_id
    where (select private.is_sisip_admin())
    union all
    select ml.id,'curator_link'::text as target_type,i.name::text as title,
      coalesce(l.title,'Look Curator')::text as context,ml.marketplace,ml.affiliate_url,
      ml.label,ml.status,ml.is_primary,ml.updated_at
    from public.curator_item_marketplace_links ml
    join public.look_curation_items i on i.id=ml.curator_item_id
    join public.looks l on l.id=i.look_id
    where (select private.is_sisip_admin()) or l.creator_id=(select auth.uid())
  ),
  filtered_links as (
    select v.* from visible_links v cross join params p
    where (p.status_filter='all' or v.status=p.status_filter)
      and (p.marketplace_filter='all' or v.marketplace=p.marketplace_filter)
      and (p.query_text='' or lower(v.title) like '%'||p.query_text||'%'
        or lower(v.context) like '%'||p.query_text||'%'
        or lower(v.affiliate_url) like '%'||p.query_text||'%')
  ),
  page_rows as (
    select f.* from filtered_links f cross join params p
    order by f.updated_at desc,f.id
    limit (select page_size from params)
    offset (select (page_number-1)*page_size from params)
  )
  select jsonb_build_object(
    'rows',coalesce((select jsonb_agg(to_jsonb(r) order by r.updated_at desc,r.id) from page_rows r),'[]'::jsonb),
    'total',(select count(*) from filtered_links),
    'page',(select page_number from params),
    'pageSize',(select page_size from params),
    'counts',jsonb_build_object(
      'active',(select count(*) from visible_links where status='active'),
      'reported',(select count(*) from visible_links where status='reported'),
      'disabled',(select count(*) from visible_links where status='disabled')
    )
  );
$$;
revoke all on function public.get_comootd_link_inventory(integer,integer,text,text,text) from public,anon;
grant execute on function public.get_comootd_link_inventory(integer,integer,text,text,text) to authenticated;

comment on column public.products.affiliate_platform is 'Derived destination platform: shopee, tiktok_shop, or website.';
comment on column public.look_curation_items.affiliate_platform is 'Derived destination platform for the Curator-owned URL.';
comment on table public.product_marketplace_links is 'Up to one active destination per supported platform for a catalogue product.';
comment on table public.curator_item_marketplace_links is 'Up to one active destination per supported platform for a Curator-owned reference item.';
