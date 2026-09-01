-- Paginated, owner-scoped link inventory for admin and Curator dashboards.
-- Created through `supabase migration new paginate_link_inventory`; the file
-- version follows the existing future-dated project migration sequence.

create index if not exists product_marketplace_links_inventory_idx
  on public.product_marketplace_links(status, marketplace, updated_at desc);

create index if not exists curator_item_marketplace_links_inventory_idx
  on public.curator_item_marketplace_links(status, marketplace, updated_at desc);

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
      case when p_marketplace in ('shopee', 'tiktok_shop') then p_marketplace else 'all' end as marketplace_filter
  ),
  visible_links as (
    select
      ml.id,
      'product_link'::text as target_type,
      p.name::text as title,
      coalesce(p.slug, 'Katalog produk')::text as context,
      ml.marketplace,
      ml.affiliate_url,
      ml.label,
      ml.status,
      ml.is_primary,
      ml.updated_at
    from public.product_marketplace_links ml
    join public.products p on p.id = ml.product_id
    where (select private.is_sisip_admin())

    union all

    select
      ml.id,
      'curator_link'::text as target_type,
      i.name::text as title,
      coalesce(l.title, 'Look Curator')::text as context,
      ml.marketplace,
      ml.affiliate_url,
      ml.label,
      ml.status,
      ml.is_primary,
      ml.updated_at
    from public.curator_item_marketplace_links ml
    join public.look_curation_items i on i.id = ml.curator_item_id
    join public.looks l on l.id = i.look_id
    where (select private.is_sisip_admin()) or l.creator_id = (select auth.uid())
  ),
  filtered_links as (
    select v.*
    from visible_links v
    cross join params p
    where (p.status_filter = 'all' or v.status = p.status_filter)
      and (p.marketplace_filter = 'all' or v.marketplace = p.marketplace_filter)
      and (
        p.query_text = ''
        or lower(v.title) like '%' || p.query_text || '%'
        or lower(v.context) like '%' || p.query_text || '%'
        or lower(v.affiliate_url) like '%' || p.query_text || '%'
      )
  ),
  page_rows as (
    select f.*
    from filtered_links f
    cross join params p
    order by f.updated_at desc, f.id
    limit (select page_size from params)
    offset (select (page_number - 1) * page_size from params)
  )
  select jsonb_build_object(
    'rows', coalesce((select jsonb_agg(to_jsonb(r) order by r.updated_at desc, r.id) from page_rows r), '[]'::jsonb),
    'total', (select count(*) from filtered_links),
    'page', (select page_number from params),
    'pageSize', (select page_size from params),
    'counts', jsonb_build_object(
      'active', (select count(*) from visible_links where status = 'active'),
      'reported', (select count(*) from visible_links where status = 'reported'),
      'disabled', (select count(*) from visible_links where status = 'disabled')
    )
  );
$$;

revoke all on function public.get_comootd_link_inventory(integer,integer,text,text,text) from public, anon;
grant execute on function public.get_comootd_link_inventory(integer,integer,text,text,text) to authenticated;
