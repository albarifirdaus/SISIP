-- Phase 4: enforce valid event/target pairs and expose aggregate attribution.
-- The table remains private and stores no IP, user-agent, or full referrer URL.

create or replace function public.record_comootd_analytics_event(
  p_event_type text, p_target_type text, p_target_id uuid, p_session_id uuid,
  p_source text default null, p_referrer_host text default null,
  p_utm_source text default null, p_utm_medium text default null,
  p_utm_campaign text default null
) returns void language plpgsql security definer set search_path='' as $$
declare v_owner_id uuid;
begin
  if p_session_id is null or not (
    (p_event_type='page_view' and p_target_type='site' and p_target_id is null) or
    (p_event_type='look_view' and p_target_type='look' and p_target_id is not null) or
    (p_event_type='product_click' and p_target_type in ('look','product','curator_item') and p_target_id is not null) or
    (p_event_type='look_share' and p_target_type='look' and p_target_id is not null) or
    (p_event_type='product_share' and p_target_type='product' and p_target_id is not null) or
    (p_event_type='curator_profile_view' and p_target_type='curator' and p_target_id is not null)
  ) then raise exception 'Event analytics tidak valid.' using errcode='22023'; end if;

  if p_target_type='look' then
    select creator_id into v_owner_id from public.looks where id=p_target_id and status='published' and published_at<=now();
  elsif p_target_type='product' then
    perform 1 from public.products where id=p_target_id and status='published' and published_at<=now();
  elsif p_target_type='curator_item' then
    select l.creator_id into v_owner_id from public.look_curation_items i join public.looks l on l.id=i.look_id
    where i.id=p_target_id and l.status='published' and l.published_at<=now();
  elsif p_target_type='curator' then
    select user_id into v_owner_id from public.curator_profiles where user_id=p_target_id and is_active;
  end if;
  if p_target_type<>'site' and not found then raise exception 'Target analytics tidak tersedia.' using errcode='22023'; end if;

  if (select count(*) from public.comootd_analytics_events where session_id=p_session_id and created_at>now()-interval '1 hour')>=300 then return; end if;
  if exists(select 1 from public.comootd_analytics_events where session_id=p_session_id and event_type=p_event_type
    and target_type=p_target_type and target_id is not distinct from p_target_id and created_at>now()-interval '8 seconds') then return; end if;

  insert into public.comootd_analytics_events(event_type,target_type,target_id,owner_id,user_id,session_id,source,referrer_host,utm_source,utm_medium,utm_campaign)
  values(p_event_type,p_target_type,p_target_id,v_owner_id,(select auth.uid()),p_session_id,
    nullif(left(btrim(coalesce(p_source,'')),64),''),nullif(left(lower(btrim(coalesce(p_referrer_host,''))),160),''),
    nullif(left(btrim(coalesce(p_utm_source,'')),100),''),nullif(left(btrim(coalesce(p_utm_medium,'')),100),''),
    nullif(left(btrim(coalesce(p_utm_campaign,'')),120),''));
end; $$;
revoke all on function public.record_comootd_analytics_event(text,text,uuid,uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.record_comootd_analytics_event(text,text,uuid,uuid,text,text,text,text,text) to anon,authenticated;

create or replace function public.get_my_comootd_analytics(p_days integer default 30)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=(select auth.uid()); v_days integer:=least(greatest(coalesce(p_days,30),1),365); v_result jsonb;
begin
  if v_user is null or not ((select private.is_active_comootd_curator()) or (select private.is_sisip_admin())) then
    raise exception 'Dashboard analytics hanya tersedia untuk curator aktif.' using errcode='42501'; end if;
  select jsonb_build_object(
    'days',v_days,
    'totals',jsonb_build_object('lookViews',count(*) filter(where event_type='look_view'),'productClicks',count(*) filter(where event_type='product_click'),'shares',count(*) filter(where event_type in ('look_share','product_share')),'profileViews',count(*) filter(where event_type='curator_profile_view'),'uniqueSessions',count(distinct session_id)),
    'daily',coalesce((select jsonb_agg(row_to_json(d) order by d.event_day) from (select created_at::date event_day,count(*) filter(where event_type='look_view') views,count(*) filter(where event_type='product_click') clicks from public.comootd_analytics_events where owner_id=v_user and created_at>=now()-(v_days||' days')::interval group by 1)d),'[]'::jsonb),
    'topLooks',coalesce((select jsonb_agg(row_to_json(t) order by t.views desc,t.clicks desc) from (select l.id,l.title,l.slug,count(*) filter(where e.event_type='look_view') views,count(*) filter(where e.event_type='product_click') clicks from public.looks l left join public.comootd_analytics_events e on e.target_type='look' and e.target_id=l.id and e.created_at>=now()-(v_days||' days')::interval where l.creator_id=v_user group by l.id,l.title,l.slug order by views desc,clicks desc limit 10)t),'[]'::jsonb),
    'sources',coalesce((select jsonb_agg(row_to_json(s) order by s.events desc) from (select coalesce(nullif(source,''),'direct') source,count(*) events from public.comootd_analytics_events where owner_id=v_user and created_at>=now()-(v_days||' days')::interval group by 1 order by 2 desc limit 8)s),'[]'::jsonb),
    'mediums',coalesce((select jsonb_agg(row_to_json(m) order by m.events desc) from (select coalesce(nullif(utm_medium,''),'tanpa medium') medium,count(*) events from public.comootd_analytics_events where owner_id=v_user and created_at>=now()-(v_days||' days')::interval group by 1 order by 2 desc limit 8)m),'[]'::jsonb),
    'campaigns',coalesce((select jsonb_agg(row_to_json(c) order by c.events desc) from (select utm_campaign campaign,count(*) events from public.comootd_analytics_events where owner_id=v_user and created_at>=now()-(v_days||' days')::interval and nullif(utm_campaign,'') is not null group by 1 order by 2 desc limit 8)c),'[]'::jsonb)
  ) into v_result from public.comootd_analytics_events where owner_id=v_user and created_at>=now()-(v_days||' days')::interval;
  return coalesce(v_result,'{}'::jsonb);
end; $$;
revoke all on function public.get_my_comootd_analytics(integer) from public,anon,authenticated;
grant execute on function public.get_my_comootd_analytics(integer) to authenticated;

create or replace function public.get_admin_comootd_analytics(p_days integer default 30)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_days integer:=least(greatest(coalesce(p_days,30),1),365); v_result jsonb;
begin
  if not(select private.is_sisip_admin()) then raise exception 'Akses admin diperlukan.' using errcode='42501'; end if;
  select jsonb_build_object(
    'days',v_days,
    'totals',jsonb_build_object('pageViews',count(*) filter(where event_type='page_view'),'lookViews',count(*) filter(where event_type='look_view'),'productClicks',count(*) filter(where event_type='product_click'),'shares',count(*) filter(where event_type in ('look_share','product_share')),'uniqueSessions',count(distinct session_id)),
    'daily',coalesce((select jsonb_agg(row_to_json(d) order by d.event_day) from (select created_at::date event_day,count(*) filter(where event_type='page_view') page_views,count(*) filter(where event_type='look_view') views,count(*) filter(where event_type='product_click') clicks from public.comootd_analytics_events where created_at>=now()-(v_days||' days')::interval group by 1)d),'[]'::jsonb),
    'topCurators',coalesce((select jsonb_agg(row_to_json(c) order by c.events desc,c.clicks desc) from (select cp.handle,cp.display_name,count(e.id) events,count(*) filter(where e.event_type='product_click') clicks from public.curator_profiles cp left join public.comootd_analytics_events e on e.owner_id=cp.user_id and e.created_at>=now()-(v_days||' days')::interval where cp.is_active group by cp.user_id,cp.handle,cp.display_name order by events desc,clicks desc limit 10)c),'[]'::jsonb),
    'sources',coalesce((select jsonb_agg(row_to_json(s) order by s.events desc) from (select coalesce(nullif(source,''),'direct') source,count(*) events from public.comootd_analytics_events where created_at>=now()-(v_days||' days')::interval group by 1 order by 2 desc limit 10)s),'[]'::jsonb),
    'mediums',coalesce((select jsonb_agg(row_to_json(m) order by m.events desc) from (select coalesce(nullif(utm_medium,''),'tanpa medium') medium,count(*) events from public.comootd_analytics_events where created_at>=now()-(v_days||' days')::interval group by 1 order by 2 desc limit 10)m),'[]'::jsonb),
    'campaigns',coalesce((select jsonb_agg(row_to_json(c) order by c.events desc) from (select utm_campaign campaign,count(*) events from public.comootd_analytics_events where created_at>=now()-(v_days||' days')::interval and nullif(utm_campaign,'') is not null group by 1 order by 2 desc limit 10)c),'[]'::jsonb)
  ) into v_result from public.comootd_analytics_events where created_at>=now()-(v_days||' days')::interval;
  return coalesce(v_result,'{}'::jsonb);
end; $$;
revoke all on function public.get_admin_comootd_analytics(integer) from public,anon,authenticated;
grant execute on function public.get_admin_comootd_analytics(integer) to authenticated;
