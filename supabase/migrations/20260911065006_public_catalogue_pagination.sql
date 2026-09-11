-- Bounded public directory reads. Invoker security preserves all existing RLS.
-- Version matches the migration applied to the hosted database.
create or replace function public.comootd_directory_page(
  p_kind text, p_page integer default 1, p_filters jsonb default '{}'::jsonb
) returns jsonb language sql stable security invoker set search_path = '' as $$
with visible_looks as (
  select l.*, exists(select 1 from public.look_curation_items i where i.look_id=l.id) as is_curator
  from public.looks l
  where l.status='published' and l.published_at<=now()
    and (not exists(select 1 from public.look_curation_items i where i.look_id=l.id)
      or exists(select 1 from public.curator_profiles c where c.user_id=l.creator_id and c.is_active))
), entities as (
  select l.id, l.title as name, l.published_at as published, l.popularity::bigint as score,
    l.style_tags as tags, l.gender_target as gender, ''::text as category, ''::text as marketplace,
    0::bigint as price, l.is_curator, l.creator_id,
    concat_ws(' ',l.title,l.gender_target,array_to_string(l.style_tags,' '),c.display_name,c.handle,
      (select string_agg(i.color_variant,' ') from public.look_curation_items i where i.look_id=l.id)) as search,
    '{}'::jsonb as stats
  from visible_looks l left join public.curator_profiles c on c.user_id=l.creator_id and c.is_active
  where p_kind in ('looks','comootd','curators','style')
  union all
  select p.id,p.name,p.published_at,0::bigint,p.style_tags,p.gender_target,p.category,p.affiliate_platform,
    p.price_idr::bigint,false,null::uuid,
    concat_ws(' ',p.name,p.category,array_to_string(p.style_tags,' '),array_to_string(p.badges,' '),
      (select string_agg(concat_ws(' ',v.label,v.color_name,v.color_hex),' ') from public.product_variants v where v.product_id=p.id and v.is_active)),
    '{}'::jsonb
  from public.products p where p_kind='products' and p.status='published' and p.is_available and p.published_at<=now()
  union all
  select c.user_id,c.display_name,c.created_at,
    coalesce((select sum(l.popularity) from visible_looks l where l.creator_id=c.user_id),0)::bigint,
    c.job_tags,''::text,''::text,''::text,0::bigint,false,c.user_id,
    concat_ws(' ',c.display_name,c.handle,c.bio,array_to_string(c.job_tags,' ')),
    jsonb_build_object('lookCount',(select count(*) from visible_looks l where l.creator_id=c.user_id),
      'totalLikes',coalesce((select sum(l.popularity) from visible_looks l where l.creator_id=c.user_id),0),
      'coverImagePath',(select l.cover_image_path from visible_looks l where l.creator_id=c.user_id order by l.published_at desc,l.id limit 1))
  from public.curator_profiles c where p_kind='directory-curators' and c.is_active
  union all
  select a.id,a.title,a.published_at,0::bigint,a.style_tags,'','','',0::bigint,false,null::uuid,
    concat_ws(' ',a.title,a.excerpt),'{}'::jsonb from public.articles a
    where p_kind='journal' and a.status='published' and a.published_at<=now()
), filtered as (
  select * from entities e where
    (coalesce(p_filters->>'q','')='' or strpos(lower(e.search),lower(left(p_filters->>'q',200)))>0)
    and (coalesce(p_filters->>'gender','all')='all' or e.gender=case p_filters->>'gender' when 'Pria' then 'pria' when 'Wanita' then 'wanita' when 'Uniseks' then 'unisex' else p_filters->>'gender' end)
    and (coalesce(p_filters->>'style','all')='all' or p_filters->>'style'=any(e.tags))
    and (coalesce(p_filters->>'tag','all')='all' or p_filters->>'tag'=any(e.tags))
    and (coalesce(p_filters->>'category','all')='all' or e.category=p_filters->>'category')
    and (coalesce(p_filters->>'marketplace','all')='all' or e.marketplace=p_filters->>'marketplace'
      or exists(select 1 from public.product_marketplace_links m where m.product_id=e.id and m.status<>'disabled' and m.marketplace=p_filters->>'marketplace'))
    and (coalesce(p_filters->>'creator','')='' or e.creator_id::text=p_filters->>'creator')
    and (p_kind<>'comootd' or not e.is_curator) and (p_kind<>'curators' or e.is_curator)
    and case coalesce(p_filters->>'price','all') when 'under100' then e.price<100000
      when '100to250' then e.price>=100000 and e.price<250000
      when '250to500' then e.price>=250000 and e.price<500000
      when 'over500' then e.price>=500000 else true end
), bounds as (
  select count(*)::integer as total, case when p_kind='directory-curators' then 12 else 24 end as size from filtered
), paging as (
  select *,least(greatest(coalesce(p_page,1),1),greatest(1,ceil(total::numeric/size)::integer)) as page from bounds
), selected as (
  select * from filtered order by
    case when p_filters->>'sort'='az' then lower(name) end asc,
    case when p_filters->>'sort'='newest' then published end desc nulls last,
    case when coalesce(p_filters->>'sort','popular') not in ('az','newest') then score end desc,
    published desc nulls last,id asc
  limit (select size from paging) offset (select (page-1)*size from paging)
)
select jsonb_build_object('ids',coalesce((select jsonb_agg(id) from selected),'[]'::jsonb),
  'stats',coalesce((select jsonb_object_agg(id::text,stats) from selected),'{}'::jsonb),
  'total',total,'page',page,'pageSize',size) from paging;
$$;
revoke all on function public.comootd_directory_page(text,integer,jsonb) from public;
grant execute on function public.comootd_directory_page(text,integer,jsonb) to anon,authenticated;

create or replace function public.comootd_curator_summaries(p_ids uuid[])
returns jsonb language sql stable security invoker set search_path='' as $$
  select coalesce(jsonb_object_agg(c.user_id::text,jsonb_build_object(
    'lookCount',(select count(*) from public.looks l where l.creator_id=c.user_id and l.status='published' and l.published_at<=now()),
    'totalLikes',coalesce((select sum(l.popularity) from public.looks l where l.creator_id=c.user_id and l.status='published' and l.published_at<=now()),0),
    'coverImagePath',(select l.cover_image_path from public.looks l where l.creator_id=c.user_id and l.status='published' and l.published_at<=now() order by l.published_at desc,l.id limit 1)
  )),'{}'::jsonb) from public.curator_profiles c where c.is_active and c.user_id=any(p_ids[1:100]);
$$;
revoke all on function public.comootd_curator_summaries(uuid[]) from public;
grant execute on function public.comootd_curator_summaries(uuid[]) to anon,authenticated;
