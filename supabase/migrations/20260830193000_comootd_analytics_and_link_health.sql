-- Milestone 2: privacy-conscious analytics and affiliate-link health.
-- No IP address, user-agent, or complete referrer URL is stored.

create table if not exists public.comootd_analytics_events (
  id bigint generated always as identity primary key,
  event_type text not null check (event_type in ('page_view','look_view','product_click','look_share','product_share','curator_profile_view')),
  target_type text not null check (target_type in ('site','look','product','curator_item','curator','article')),
  target_id uuid,
  owner_id uuid references public.profiles(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  session_id uuid not null,
  source text check (source is null or char_length(source) <= 64),
  referrer_host text check (referrer_host is null or char_length(referrer_host) <= 160),
  utm_source text check (utm_source is null or char_length(utm_source) <= 100),
  utm_medium text check (utm_medium is null or char_length(utm_medium) <= 100),
  utm_campaign text check (utm_campaign is null or char_length(utm_campaign) <= 120),
  created_at timestamptz not null default now()
);

create index if not exists comootd_analytics_owner_created_idx
  on public.comootd_analytics_events (owner_id, created_at desc);
create index if not exists comootd_analytics_target_created_idx
  on public.comootd_analytics_events (target_type, target_id, created_at desc);
create index if not exists comootd_analytics_session_created_idx
  on public.comootd_analytics_events (session_id, created_at desc);

alter table public.comootd_analytics_events enable row level security;
revoke all on table public.comootd_analytics_events from public, anon, authenticated;

create or replace function public.record_comootd_analytics_event(
  p_event_type text,
  p_target_type text,
  p_target_id uuid,
  p_session_id uuid,
  p_source text default null,
  p_referrer_host text default null,
  p_utm_source text default null,
  p_utm_medium text default null,
  p_utm_campaign text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid;
begin
  if p_event_type not in ('page_view','look_view','product_click','look_share','product_share','curator_profile_view')
    or p_target_type not in ('site','look','product','curator_item','curator','article')
    or p_session_id is null then
    raise exception 'Event analytics tidak valid.' using errcode = '22023';
  end if;

  if p_target_type = 'site' then
    if p_target_id is not null then raise exception 'Target site tidak memakai ID.'; end if;
  elsif p_target_type = 'look' then
    select l.creator_id into v_owner_id from public.looks l
    where l.id = p_target_id and l.status = 'published' and l.published_at <= now();
  elsif p_target_type = 'product' then
    perform 1 from public.products p
    where p.id = p_target_id and p.status = 'published' and p.published_at <= now();
  elsif p_target_type = 'curator_item' then
    select l.creator_id into v_owner_id
    from public.look_curation_items i join public.looks l on l.id = i.look_id
    where i.id = p_target_id and l.status = 'published' and l.published_at <= now();
  elsif p_target_type = 'curator' then
    select cp.user_id into v_owner_id from public.curator_profiles cp
    where cp.user_id = p_target_id and cp.is_active;
  elsif p_target_type = 'article' then
    select a.author_id into v_owner_id from public.articles a
    where a.id = p_target_id and a.status = 'published' and a.published_at <= now();
  end if;

  if p_target_type <> 'site' and not found then
    raise exception 'Target analytics tidak tersedia.' using errcode = '22023';
  end if;

  -- A browser session should never generate hundreds of useful events per hour.
  -- This keeps accidental loops and basic event spam from growing the table.
  if (
    select count(*)
    from public.comootd_analytics_events e
    where e.session_id = p_session_id
      and e.created_at > now() - interval '1 hour'
  ) >= 300 then
    return;
  end if;

  -- Suppress rapid duplicate events from the same browser session.
  if exists (
    select 1 from public.comootd_analytics_events e
    where e.session_id = p_session_id
      and e.event_type = p_event_type
      and e.target_type = p_target_type
      and e.target_id is not distinct from p_target_id
      and e.created_at > now() - interval '8 seconds'
  ) then return; end if;

  insert into public.comootd_analytics_events (
    event_type,target_type,target_id,owner_id,user_id,session_id,source,referrer_host,utm_source,utm_medium,utm_campaign
  ) values (
    p_event_type,p_target_type,p_target_id,v_owner_id,(select auth.uid()),p_session_id,
    nullif(left(btrim(coalesce(p_source,'')),64),''),
    nullif(left(lower(btrim(coalesce(p_referrer_host,''))),160),''),
    nullif(left(btrim(coalesce(p_utm_source,'')),100),''),
    nullif(left(btrim(coalesce(p_utm_medium,'')),100),''),
    nullif(left(btrim(coalesce(p_utm_campaign,'')),120),'')
  );
end;
$$;

revoke all on function public.record_comootd_analytics_event(text,text,uuid,uuid,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.record_comootd_analytics_event(text,text,uuid,uuid,text,text,text,text,text) to anon, authenticated;

create or replace function public.get_my_comootd_analytics(p_days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_user uuid := (select auth.uid()); v_days integer := least(greatest(coalesce(p_days,30),1),365); v_result jsonb;
begin
  if v_user is null or not ((select private.is_active_comootd_curator()) or (select private.is_sisip_admin())) then
    raise exception 'Dashboard analytics hanya tersedia untuk curator aktif.' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'days',v_days,
    'totals',jsonb_build_object(
      'lookViews',count(*) filter (where event_type='look_view'),
      'productClicks',count(*) filter (where event_type='product_click'),
      'shares',count(*) filter (where event_type in ('look_share','product_share')),
      'profileViews',count(*) filter (where event_type='curator_profile_view'),
      'uniqueSessions',count(distinct session_id)
    ),
    'daily',coalesce((select jsonb_agg(row_to_json(d) order by d.event_day) from (
      select created_at::date as event_day,count(*) filter (where event_type='look_view') views,count(*) filter (where event_type='product_click') clicks
      from public.comootd_analytics_events where owner_id=v_user and created_at>=now()-(v_days||' days')::interval group by 1
    ) d),'[]'::jsonb),
    'topLooks',coalesce((select jsonb_agg(row_to_json(t) order by t.views desc) from (
      select l.id,l.title,l.slug,count(*) filter (where e.event_type='look_view') views,count(*) filter (where e.event_type='product_click') clicks
      from public.looks l left join public.comootd_analytics_events e on e.target_type='look' and e.target_id=l.id and e.created_at>=now()-(v_days||' days')::interval
      where l.creator_id=v_user group by l.id,l.title,l.slug order by views desc limit 10
    ) t),'[]'::jsonb),
    'sources',coalesce((select jsonb_agg(row_to_json(s) order by s.events desc) from (
      select coalesce(nullif(source,''),'direct') source,count(*) events from public.comootd_analytics_events
      where owner_id=v_user and created_at>=now()-(v_days||' days')::interval group by 1 order by 2 desc limit 8
    ) s),'[]'::jsonb)
  ) into v_result
  from public.comootd_analytics_events
  where owner_id=v_user and created_at>=now()-(v_days||' days')::interval;
  return coalesce(v_result,'{}'::jsonb);
end;
$$;

revoke all on function public.get_my_comootd_analytics(integer) from public, anon, authenticated;
grant execute on function public.get_my_comootd_analytics(integer) to authenticated;

create or replace function public.get_admin_comootd_analytics(p_days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_days integer := least(greatest(coalesce(p_days,30),1),365); v_result jsonb;
begin
  if not (select private.is_sisip_admin()) then raise exception 'Akses admin diperlukan.' using errcode='42501'; end if;
  select jsonb_build_object(
    'days',v_days,
    'totals',jsonb_build_object(
      'pageViews',count(*) filter (where event_type='page_view'),
      'lookViews',count(*) filter (where event_type='look_view'),
      'productClicks',count(*) filter (where event_type='product_click'),
      'shares',count(*) filter (where event_type in ('look_share','product_share')),
      'uniqueSessions',count(distinct session_id)
    ),
    'topCurators',coalesce((select jsonb_agg(row_to_json(c) order by c.events desc) from (
      select cp.handle,cp.display_name,count(e.id) events,count(*) filter (where e.event_type='product_click') clicks
      from public.curator_profiles cp left join public.comootd_analytics_events e on e.owner_id=cp.user_id and e.created_at>=now()-(v_days||' days')::interval
      where cp.is_active group by cp.user_id,cp.handle,cp.display_name order by events desc limit 10
    ) c),'[]'::jsonb),
    'sources',coalesce((select jsonb_agg(row_to_json(s) order by s.events desc) from (
      select coalesce(nullif(source,''),'direct') source,count(*) events from public.comootd_analytics_events
      where created_at>=now()-(v_days||' days')::interval group by 1 order by 2 desc limit 10
    ) s),'[]'::jsonb)
  ) into v_result from public.comootd_analytics_events where created_at>=now()-(v_days||' days')::interval;
  return coalesce(v_result,'{}'::jsonb);
end;
$$;

revoke all on function public.get_admin_comootd_analytics(integer) from public, anon, authenticated;
grant execute on function public.get_admin_comootd_analytics(integer) to authenticated;

alter table public.products add column if not exists link_status text not null default 'active' check (link_status in ('active','reported','disabled'));
alter table public.look_curation_items add column if not exists link_status text not null default 'active' check (link_status in ('active','reported','disabled'));

create table if not exists public.comootd_link_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  owner_id uuid references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('product','curator_item')),
  target_id uuid not null,
  reason text not null check (reason in ('broken','wrong_product','out_of_stock','price_mismatch','unsafe','other')),
  message text check (message is null or char_length(btrim(message)) <= 500),
  status text not null default 'open' check (status in ('open','resolved','dismissed','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null
);
create unique index if not exists comootd_link_reports_one_open_idx on public.comootd_link_reports(reporter_id,target_type,target_id) where status='open';
create index if not exists comootd_link_reports_owner_status_idx on public.comootd_link_reports(owner_id,status,created_at desc);
alter table public.comootd_link_reports enable row level security;

create policy "Reporters read own link reports" on public.comootd_link_reports for select to authenticated using (reporter_id=(select auth.uid()));
create policy "Curators read reports for own links" on public.comootd_link_reports for select to authenticated using (owner_id=(select auth.uid()));
create policy "COMOOTD admin reads all link reports" on public.comootd_link_reports for select to authenticated using ((select private.is_sisip_admin()));
revoke all on table public.comootd_link_reports from public,anon,authenticated;
grant select on table public.comootd_link_reports to authenticated;

create or replace function public.report_comootd_link(p_target_type text,p_target_id uuid,p_reason text,p_message text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_owner uuid; v_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Masuk untuk melaporkan tautan.' using errcode='42501'; end if;
  if p_reason not in ('broken','wrong_product','out_of_stock','price_mismatch','unsafe','other') then raise exception 'Alasan laporan tidak valid.'; end if;
  if p_target_type='product' then
    perform 1 from public.products p where p.id=p_target_id and p.status='published';
  elsif p_target_type='curator_item' then
    select l.creator_id into v_owner from public.look_curation_items i join public.looks l on l.id=i.look_id where i.id=p_target_id and l.status='published';
  else raise exception 'Target laporan tidak valid.'; end if;
  if not found then raise exception 'Tautan tidak tersedia.'; end if;
  insert into public.comootd_link_reports(reporter_id,owner_id,target_type,target_id,reason,message)
  values((select auth.uid()),v_owner,p_target_type,p_target_id,p_reason,nullif(left(btrim(coalesce(p_message,'')),500),''))
  on conflict (reporter_id,target_type,target_id) where status='open' do update set reason=excluded.reason,message=excluded.message,updated_at=now()
  returning id into v_id;
  if p_target_type='product' then update public.products set link_status='reported' where id=p_target_id and link_status='active';
  else update public.look_curation_items set link_status='reported' where id=p_target_id and link_status='active'; end if;
  return v_id;
end; $$;

revoke all on function public.report_comootd_link(text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.report_comootd_link(text,uuid,text,text) to authenticated;

create or replace function public.resolve_comootd_link_report(p_report_id uuid,p_action text,p_replacement_url text default null)
returns void language plpgsql security definer set search_path='' as $$
declare r public.comootd_link_reports%rowtype; v_admin boolean := (select private.is_sisip_admin());
begin
  select * into r from public.comootd_link_reports where id=p_report_id for update;
  if not found or (not v_admin and r.owner_id is distinct from (select auth.uid())) then raise exception 'Laporan tidak tersedia.' using errcode='42501'; end if;
  if p_action not in ('resolved','dismissed','disabled','updated') then raise exception 'Tindakan tidak valid.'; end if;
  if p_action='updated' and (p_replacement_url is null or lower(p_replacement_url) !~ E'^https://(([a-z0-9-]+\\.)*shopee\\.co\\.id|shope\\.ee)(/|$)') then raise exception 'Gunakan tautan Shopee yang valid.'; end if;
  if r.target_type='product' then
    update public.products set affiliate_url=case when p_action='updated' then p_replacement_url else affiliate_url end,link_status=case when p_action='disabled' then 'disabled' else 'active' end,is_available=case when p_action='disabled' then false else true end where id=r.target_id;
  else
    update public.look_curation_items set affiliate_url=case when p_action='updated' then p_replacement_url else affiliate_url end,link_status=case when p_action='disabled' then 'disabled' else 'active' end where id=r.target_id;
  end if;
  update public.comootd_link_reports set status=case when p_action='updated' then 'resolved' else p_action end,updated_at=now(),resolved_at=now(),resolved_by=(select auth.uid()) where id=p_report_id;
end; $$;

revoke all on function public.resolve_comootd_link_report(uuid,text,text) from public,anon,authenticated;
grant execute on function public.resolve_comootd_link_report(uuid,text,text) to authenticated;
