-- COMOOTD Phase 7: multi-destination marketplace links and link-health workflow.
-- Existing affiliate_url columns remain as the primary-link compatibility layer.

alter table public.products
  drop constraint if exists products_affiliate_url_shopee_check;

alter table public.comootd_notifications
  drop constraint if exists comootd_notifications_kind_check;
alter table public.comootd_notifications
  add constraint comootd_notifications_kind_check
  check (kind in ('curator_application','moderation','system','link_health'));

create table if not exists public.product_marketplace_links (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  marketplace text not null check (marketplace in ('shopee','tiktok_shop')),
  affiliate_url text not null,
  label text check (label is null or char_length(btrim(label)) between 1 and 60),
  status text not null default 'active' check (status in ('active','reported','disabled')),
  is_primary boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_marketplace_links_url_check
    check (marketplace = private.comootd_marketplace_for_url(affiliate_url)),
  constraint product_marketplace_links_product_marketplace_key unique(product_id,marketplace)
);

create table if not exists public.curator_item_marketplace_links (
  id uuid primary key default gen_random_uuid(),
  curator_item_id uuid not null references public.look_curation_items(id) on delete cascade,
  marketplace text not null check (marketplace in ('shopee','tiktok_shop')),
  affiliate_url text not null,
  label text check (label is null or char_length(btrim(label)) between 1 and 60),
  status text not null default 'active' check (status in ('active','reported','disabled')),
  is_primary boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint curator_item_marketplace_links_url_check
    check (marketplace = private.comootd_marketplace_for_url(affiliate_url)),
  constraint curator_item_marketplace_links_item_marketplace_key unique(curator_item_id,marketplace)
);

create unique index if not exists product_marketplace_links_one_primary_idx
  on public.product_marketplace_links(product_id) where is_primary;
create index if not exists product_marketplace_links_public_idx
  on public.product_marketplace_links(product_id,status,is_primary desc);
create unique index if not exists curator_item_marketplace_links_one_primary_idx
  on public.curator_item_marketplace_links(curator_item_id) where is_primary;
create index if not exists curator_item_marketplace_links_public_idx
  on public.curator_item_marketplace_links(curator_item_id,status,is_primary desc);

alter table public.product_marketplace_links enable row level security;
alter table public.curator_item_marketplace_links enable row level security;
revoke all on table public.product_marketplace_links from public,anon,authenticated;
revoke all on table public.curator_item_marketplace_links from public,anon,authenticated;
grant select on table public.product_marketplace_links to anon,authenticated;
grant select on table public.curator_item_marketplace_links to anon,authenticated;

create policy "Published product marketplace links are public"
  on public.product_marketplace_links for select to anon,authenticated
  using (
    status <> 'disabled' and exists (
      select 1 from public.products p
      where p.id=product_id and p.status='published' and p.published_at<=now()
    )
  );
create policy "Admin reads all product marketplace links"
  on public.product_marketplace_links for select to authenticated
  using ((select private.is_sisip_admin()));

create policy "Published curator marketplace links are public"
  on public.curator_item_marketplace_links for select to anon,authenticated
  using (
    status <> 'disabled' and exists (
      select 1 from public.look_curation_items i
      join public.looks l on l.id=i.look_id
      where i.id=curator_item_id and l.status='published' and l.published_at<=now()
    )
  );
create policy "Owners and admin read all curator marketplace links"
  on public.curator_item_marketplace_links for select to authenticated
  using (
    (select private.is_sisip_admin()) or exists (
      select 1 from public.look_curation_items i
      join public.looks l on l.id=i.look_id
      where i.id=curator_item_id and l.creator_id=(select auth.uid())
    )
  );

create table if not exists public.comootd_marketplace_link_history (
  id bigint generated always as identity primary key,
  target_type text not null check (target_type in ('product_link','curator_link')),
  link_id uuid not null,
  owner_id uuid references public.profiles(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null check (action in ('added','updated','activated','disabled','reported','resolved','dismissed','primary_changed')),
  marketplace text not null check (marketplace in ('shopee','tiktok_shop')),
  previous_url text,
  next_url text,
  created_at timestamptz not null default now()
);
create index if not exists comootd_marketplace_link_history_owner_idx
  on public.comootd_marketplace_link_history(owner_id,created_at desc);
create index if not exists comootd_marketplace_link_history_link_idx
  on public.comootd_marketplace_link_history(target_type,link_id,created_at desc);
alter table public.comootd_marketplace_link_history enable row level security;
revoke all on table public.comootd_marketplace_link_history from public,anon,authenticated;
grant select on table public.comootd_marketplace_link_history to authenticated;
create policy "Owners and admin read marketplace link history"
  on public.comootd_marketplace_link_history for select to authenticated
  using ((select private.is_sisip_admin()) or owner_id=(select auth.uid()));

insert into public.product_marketplace_links(product_id,marketplace,affiliate_url,label,status,is_primary)
select id,affiliate_platform,affiliate_url,
  case affiliate_platform when 'tiktok_shop' then 'TikTok Shop' else 'Shopee' end,
  link_status,true
from public.products
on conflict(product_id,marketplace) do update set
  affiliate_url=excluded.affiliate_url,status=excluded.status,is_primary=true,updated_at=now();

insert into public.curator_item_marketplace_links(curator_item_id,marketplace,affiliate_url,label,status,is_primary,created_by)
select i.id,i.affiliate_platform,i.affiliate_url,
  case i.affiliate_platform when 'tiktok_shop' then 'TikTok Shop' else 'Shopee' end,
  i.link_status,true,l.creator_id
from public.look_curation_items i join public.looks l on l.id=i.look_id
on conflict(curator_item_id,marketplace) do update set
  affiliate_url=excluded.affiliate_url,status=excluded.status,is_primary=true,updated_at=now();

create or replace function private.sync_product_marketplace_link()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  update public.product_marketplace_links set is_primary=false,updated_at=now()
  where product_id=new.id and marketplace<>new.affiliate_platform and is_primary;
  insert into public.product_marketplace_links(product_id,marketplace,affiliate_url,label,status,is_primary,created_by)
  values(new.id,new.affiliate_platform,new.affiliate_url,
    case new.affiliate_platform when 'tiktok_shop' then 'TikTok Shop' else 'Shopee' end,
    new.link_status,true,(select auth.uid()))
  on conflict(product_id,marketplace) do update set
    affiliate_url=excluded.affiliate_url,status=excluded.status,is_primary=true,updated_at=now();
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
    case new.affiliate_platform when 'tiktok_shop' then 'TikTok Shop' else 'Shopee' end,
    new.link_status,true,v_owner)
  on conflict(curator_item_id,marketplace) do update set
    affiliate_url=excluded.affiliate_url,status=excluded.status,is_primary=true,updated_at=now();
  return new;
end $$;
revoke all on function private.sync_curator_item_marketplace_link() from public,anon,authenticated;

drop trigger if exists phase7_sync_product_marketplace_link on public.products;
create trigger phase7_sync_product_marketplace_link
after insert or update of affiliate_url,affiliate_platform,link_status on public.products
for each row execute function private.sync_product_marketplace_link();
drop trigger if exists phase7_sync_curator_item_marketplace_link on public.look_curation_items;
create trigger phase7_sync_curator_item_marketplace_link
after insert or update of affiliate_url,affiliate_platform,link_status on public.look_curation_items
for each row execute function private.sync_curator_item_marketplace_link();

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
    raise exception 'Simpan satu atau dua tujuan marketplace.';
  end if;
  select count(*) into v_primary_count from jsonb_array_elements(p_links) e where coalesce((e->>'is_primary')::boolean,false);
  if v_primary_count<>1 then raise exception 'Pilih tepat satu link utama.'; end if;
  if (select count(distinct e->>'marketplace') from jsonb_array_elements(p_links) e)<>jsonb_array_length(p_links) then
    raise exception 'Satu marketplace hanya boleh dipakai sekali.';
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
    if v_marketplace not in ('shopee','tiktok_shop') or private.comootd_marketplace_for_url(v_url) is distinct from v_marketplace then
      raise exception 'Pastikan link sesuai marketplace yang dipilih.';
    end if;
    if p_target_type='product' then
      select id,affiliate_url,status into v_id,v_previous_url,v_previous_status
      from public.product_marketplace_links where product_id=p_target_id and marketplace=v_marketplace;
      v_existed:=found;
      insert into public.product_marketplace_links(product_id,marketplace,affiliate_url,label,status,is_primary,created_by)
      values(p_target_id,v_marketplace,v_url,coalesce(v_label,case v_marketplace when 'tiktok_shop' then 'TikTok Shop' else 'Shopee' end),'active',v_primary,v_actor)
      on conflict(product_id,marketplace) do update set affiliate_url=excluded.affiliate_url,label=excluded.label,status='active',is_primary=excluded.is_primary,updated_at=now()
      returning id into v_id;
    else
      select id,affiliate_url,status into v_id,v_previous_url,v_previous_status
      from public.curator_item_marketplace_links where curator_item_id=p_target_id and marketplace=v_marketplace;
      v_existed:=found;
      insert into public.curator_item_marketplace_links(curator_item_id,marketplace,affiliate_url,label,status,is_primary,created_by)
      values(p_target_id,v_marketplace,v_url,coalesce(v_label,case v_marketplace when 'tiktok_shop' then 'TikTok Shop' else 'Shopee' end),'active',v_primary,v_actor)
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

create or replace function public.set_comootd_marketplace_links(p_target_type text,p_target_id uuid,p_links jsonb)
returns void language plpgsql security invoker set search_path='' as $$
begin perform private.set_comootd_marketplace_links(p_target_type,p_target_id,p_links); end $$;
revoke all on function public.set_comootd_marketplace_links(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.set_comootd_marketplace_links(text,uuid,jsonb) to authenticated;

alter table public.comootd_link_reports drop constraint if exists comootd_link_reports_target_type_check;
alter table public.comootd_link_reports add constraint comootd_link_reports_target_type_check
  check(target_type in ('product','curator_item','product_link','curator_link'));

create or replace function private.report_comootd_link(p_target_type text,p_target_id uuid,p_reason text,p_message text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_owner uuid; v_id uuid; v_title text; v_link_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Masuk untuk melaporkan tautan.' using errcode='42501'; end if;
  if p_reason not in ('broken','wrong_product','out_of_stock','price_mismatch','unsafe','other') then raise exception 'Alasan laporan tidak valid.'; end if;
  if p_target_type='product' then
    select p.name into v_title from public.products p where p.id=p_target_id and p.status='published';
  elsif p_target_type='curator_item' then
    select l.creator_id,i.name into v_owner,v_title from public.look_curation_items i join public.looks l on l.id=i.look_id where i.id=p_target_id and l.status='published';
  elsif p_target_type='product_link' then
    select ml.id,p.name into v_link_id,v_title from public.product_marketplace_links ml join public.products p on p.id=ml.product_id where ml.id=p_target_id and ml.status<>'disabled' and p.status='published';
  elsif p_target_type='curator_link' then
    select l.creator_id,ml.id,i.name into v_owner,v_link_id,v_title from public.curator_item_marketplace_links ml join public.look_curation_items i on i.id=ml.curator_item_id join public.looks l on l.id=i.look_id where ml.id=p_target_id and ml.status<>'disabled' and l.status='published';
  else raise exception 'Target laporan tidak valid.'; end if;
  if not found then raise exception 'Tautan tidak tersedia.'; end if;
  insert into public.comootd_link_reports(reporter_id,owner_id,target_type,target_id,reason,message)
  values((select auth.uid()),v_owner,p_target_type,p_target_id,p_reason,nullif(left(btrim(coalesce(p_message,'')),500),''))
  on conflict(reporter_id,target_type,target_id) where status='open' do update set reason=excluded.reason,message=excluded.message,updated_at=now()
  returning id into v_id;
  if p_target_type='product' then update public.products set link_status='reported' where id=p_target_id and link_status='active';
  elsif p_target_type='curator_item' then update public.look_curation_items set link_status='reported' where id=p_target_id and link_status='active';
  elsif p_target_type='product_link' then update public.product_marketplace_links set status='reported',updated_at=now() where id=p_target_id and status='active';
  else update public.curator_item_marketplace_links set status='reported',updated_at=now() where id=p_target_id and status='active'; end if;
  if v_owner is not null then
    insert into public.comootd_notifications(user_id,kind,title,message,action_url)
    values(v_owner,'link_health','Link produk perlu diperiksa',coalesce(v_title,'Produk')||' menerima laporan baru. Buka Analytics untuk memperbarui atau menonaktifkan link.','/#link-health');
  else
    insert into public.comootd_notifications(user_id,kind,title,message,action_url)
    select r.user_id,'link_health','Link produk perlu diperiksa',coalesce(v_title,'Produk')||' menerima laporan baru. Buka Studio Insights untuk menanganinya.','/#link-health'
    from private.comootd_account_roles r where r.account_role='admin';
  end if;
  return v_id;
end $$;
revoke all on function private.report_comootd_link(text,uuid,text,text) from public,anon,authenticated;
grant execute on function private.report_comootd_link(text,uuid,text,text) to authenticated;

create or replace function public.report_comootd_link(p_target_type text,p_target_id uuid,p_reason text,p_message text default null)
returns uuid language plpgsql security invoker set search_path='' as $$
begin return private.report_comootd_link(p_target_type,p_target_id,p_reason,p_message); end $$;
revoke all on function public.report_comootd_link(text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.report_comootd_link(text,uuid,text,text) to authenticated;

create or replace function private.resolve_comootd_link_report(p_report_id uuid,p_action text,p_replacement_url text default null)
returns void language plpgsql security definer set search_path='' as $$
declare r public.comootd_link_reports%rowtype; v_admin boolean:=(select private.is_sisip_admin()); v_marketplace text; v_old_url text; v_target_name text;
begin
  select * into r from public.comootd_link_reports where id=p_report_id for update;
  if not found or (not v_admin and r.owner_id is distinct from (select auth.uid())) then raise exception 'Laporan tidak tersedia.' using errcode='42501'; end if;
  if p_action not in ('resolved','dismissed','disabled','updated') then raise exception 'Tindakan tidak valid.'; end if;
  if r.target_type='product_link' then
    select marketplace,affiliate_url into v_marketplace,v_old_url from public.product_marketplace_links where id=r.target_id for update;
  elsif r.target_type='curator_link' then
    select marketplace,affiliate_url into v_marketplace,v_old_url from public.curator_item_marketplace_links where id=r.target_id for update;
  elsif r.target_type='product' then select affiliate_platform,affiliate_url into v_marketplace,v_old_url from public.products where id=r.target_id for update;
  else select affiliate_platform,affiliate_url into v_marketplace,v_old_url from public.look_curation_items where id=r.target_id for update; end if;
  if p_action='updated' and private.comootd_marketplace_for_url(p_replacement_url) is distinct from v_marketplace then
    raise exception 'Link pengganti harus berasal dari marketplace yang sama.';
  end if;
  if r.target_type='product_link' then
    update public.product_marketplace_links set affiliate_url=case when p_action='updated' then p_replacement_url else affiliate_url end,status=case when p_action='disabled' then 'disabled' else 'active' end,updated_at=now() where id=r.target_id;
    update public.products p set affiliate_url=case when p_action='updated' then p_replacement_url else p.affiliate_url end,link_status=case when p_action='disabled' then 'disabled' else 'active' end,is_available=p_action<>'disabled'
      from public.product_marketplace_links ml where ml.id=r.target_id and ml.product_id=p.id and ml.is_primary;
  elsif r.target_type='curator_link' then
    update public.curator_item_marketplace_links set affiliate_url=case when p_action='updated' then p_replacement_url else affiliate_url end,status=case when p_action='disabled' then 'disabled' else 'active' end,updated_at=now() where id=r.target_id;
    update public.look_curation_items i set affiliate_url=case when p_action='updated' then p_replacement_url else i.affiliate_url end,link_status=case when p_action='disabled' then 'disabled' else 'active' end
      from public.curator_item_marketplace_links ml where ml.id=r.target_id and ml.curator_item_id=i.id and ml.is_primary;
  elsif r.target_type='product' then
    update public.products set affiliate_url=case when p_action='updated' then p_replacement_url else affiliate_url end,link_status=case when p_action='disabled' then 'disabled' else 'active' end,is_available=p_action<>'disabled' where id=r.target_id;
  else
    update public.look_curation_items set affiliate_url=case when p_action='updated' then p_replacement_url else affiliate_url end,link_status=case when p_action='disabled' then 'disabled' else 'active' end where id=r.target_id;
  end if;
  if r.target_type in ('product_link','curator_link') then
    insert into public.comootd_marketplace_link_history(target_type,link_id,owner_id,actor_id,action,marketplace,previous_url,next_url)
    values(r.target_type,r.target_id,r.owner_id,(select auth.uid()),case when p_action='updated' then 'updated' when p_action='disabled' then 'disabled' when p_action='dismissed' then 'dismissed' else 'resolved' end,v_marketplace,v_old_url,case when p_action='updated' then p_replacement_url else v_old_url end);
  end if;
  update public.comootd_link_reports set status=case when p_action='updated' then 'resolved' else p_action end,updated_at=now(),resolved_at=now(),resolved_by=(select auth.uid()) where id=p_report_id;
  insert into public.comootd_notifications(user_id,kind,title,message,action_url)
  values(r.reporter_id,'link_health','Laporan link sudah ditangani','Terima kasih. Laporanmu telah ditinjau oleh pemilik link atau tim COMOOTD.','/');
end $$;
revoke all on function private.resolve_comootd_link_report(uuid,text,text) from public,anon,authenticated;
grant execute on function private.resolve_comootd_link_report(uuid,text,text) to authenticated;

create or replace function public.resolve_comootd_link_report(p_report_id uuid,p_action text,p_replacement_url text default null)
returns void language plpgsql security invoker set search_path='' as $$
begin perform private.resolve_comootd_link_report(p_report_id,p_action,p_replacement_url); end $$;
revoke all on function public.resolve_comootd_link_report(uuid,text,text) from public,anon,authenticated;
grant execute on function public.resolve_comootd_link_report(uuid,text,text) to authenticated;

comment on table public.product_marketplace_links is 'Up to one active destination per supported marketplace for a catalogue product.';
comment on table public.curator_item_marketplace_links is 'Up to one active destination per supported marketplace for a Curator-owned reference item.';
comment on table public.comootd_marketplace_link_history is 'Private audit trail for marketplace link changes and moderation actions.';
