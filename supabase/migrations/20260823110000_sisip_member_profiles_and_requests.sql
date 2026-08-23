-- SISIP members: personal style preferences and authenticated outfit requests.
-- Requests are intentionally member-only; anonymous visitors keep catalogue access
-- but cannot write to the request queue.

create table if not exists public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  gender_target text check (gender_target is null or gender_target in ('pria', 'wanita', 'unisex')),
  style_tags text[] not null default '{}',
  occasion_tags text[] not null default '{}',
  preferred_colors text[] not null default '{}',
  avoided_colors text[] not null default '{}',
  budget_min_idr integer check (budget_min_idr is null or budget_min_idr >= 0),
  budget_max_idr integer check (budget_max_idr is null or budget_max_idr >= 0),
  body_notes text check (body_notes is null or char_length(btrim(body_notes)) between 1 and 1000),
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_preferences_budget_range_check check (
    budget_min_idr is null
    or budget_max_idr is null
    or budget_max_idr >= budget_min_idr
  ),
  constraint user_preferences_tag_counts_check check (
    cardinality(style_tags) <= 12
    and cardinality(occasion_tags) <= 12
    and cardinality(preferred_colors) <= 12
    and cardinality(avoided_colors) <= 12
  )
);

alter table public.outfit_requests
  add column if not exists requester_id uuid references public.profiles(id) on delete set null,
  add column if not exists response_message text,
  add column if not exists responded_at timestamptz;

alter table public.outfit_requests
  drop constraint if exists outfit_requests_response_message_length_check;

alter table public.outfit_requests
  add constraint outfit_requests_response_message_length_check
  check (
    response_message is null
    or char_length(btrim(response_message)) between 1 and 3000
  );

create table if not exists public.outfit_request_admin_notes (
  request_id uuid primary key references public.outfit_requests(id) on delete cascade,
  note text not null check (char_length(btrim(note)) between 1 and 3000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Preserve historical notes, then move internal data out of the user-readable row.
insert into public.outfit_request_admin_notes (request_id, note)
select id, admin_notes
from public.outfit_requests
where nullif(btrim(admin_notes), '') is not null
on conflict (request_id) do update set note = excluded.note, updated_at = now();

alter table public.outfit_requests drop column if exists admin_notes;

create table if not exists public.outfit_request_recommendations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.outfit_requests(id) on delete cascade,
  position smallint not null check (position between 1 and 6),
  target_type text not null check (target_type in ('look', 'product')),
  look_id uuid references public.looks(id) on delete restrict,
  product_id uuid references public.products(id) on delete restrict,
  label text not null check (char_length(btrim(label)) between 1 and 80),
  created_at timestamptz not null default now(),
  constraint outfit_request_recommendations_position_key unique (request_id, position),
  constraint outfit_request_recommendations_one_target_check check (
    (target_type = 'look' and look_id is not null and product_id is null)
    or
    (target_type = 'product' and product_id is not null and look_id is null)
  )
);

create unique index if not exists outfit_request_recommendations_request_look_key
  on public.outfit_request_recommendations (request_id, look_id)
  where look_id is not null;

create unique index if not exists outfit_request_recommendations_request_product_key
  on public.outfit_request_recommendations (request_id, product_id)
  where product_id is not null;

create index if not exists outfit_requests_member_queue_idx
  on public.outfit_requests (requester_id, created_at desc)
  where requester_id is not null;

create index if not exists outfit_request_recommendations_request_idx
  on public.outfit_request_recommendations (request_id, position);

drop trigger if exists user_preferences_set_updated_at on public.user_preferences;
create trigger user_preferences_set_updated_at
  before update on public.user_preferences
  for each row execute procedure public.set_updated_at();

drop trigger if exists outfit_request_admin_notes_set_updated_at on public.outfit_request_admin_notes;
create trigger outfit_request_admin_notes_set_updated_at
  before update on public.outfit_request_admin_notes
  for each row execute procedure public.set_updated_at();

-- New members receive their profile and preference row within the Auth signup transaction.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), 'SISIP Member')
  )
  on conflict (id) do nothing;

  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

insert into public.profiles (id, display_name)
select
  u.id,
  coalesce(nullif(btrim(u.raw_user_meta_data ->> 'display_name'), ''), 'SISIP Member')
from auth.users as u
on conflict (id) do nothing;

insert into public.user_preferences (user_id)
select p.id
from public.profiles as p
on conflict (user_id) do nothing;

-- The database, not the browser payload, pins a member request to the session user.
create or replace function public.prepare_member_outfit_request()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not (select private.is_sisip_admin()) then
    if (select auth.uid()) is null then
      raise exception 'Masuk terlebih dahulu untuk mengirim request outfit.';
    end if;

    new.requester_id := (select auth.uid());
    new.requester_email := coalesce((select auth.jwt() ->> 'email'), new.requester_email);
    select p.display_name into new.requester_name
    from public.profiles as p
    where p.id = new.requester_id;
    new.status := 'new';
    new.response_message := null;
    new.responded_at := null;
  end if;

  return new;
end;
$$;

revoke all on function public.prepare_member_outfit_request() from public, anon, authenticated;

drop trigger if exists outfit_requests_prepare_member_insert on public.outfit_requests;
create trigger outfit_requests_prepare_member_insert
  before insert on public.outfit_requests
  for each row execute procedure public.prepare_member_outfit_request();

create or replace function public.require_valid_outfit_request_recommendation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_is_published boolean;
begin
  if new.target_type = 'look' then
    select exists (
      select 1
      from public.looks as l
      where l.id = new.look_id
        and l.status = 'published'
        and l.published_at <= now()
    ) into target_is_published;
  else
    select exists (
      select 1
      from public.products as p
      where p.id = new.product_id
        and p.status = 'published'
        and p.published_at <= now()
    ) into target_is_published;
  end if;

  if not coalesce(target_is_published, false) then
    raise exception 'Rekomendasi request hanya dapat menunjuk look atau produk yang sudah published.';
  end if;

  return new;
end;
$$;

revoke all on function public.require_valid_outfit_request_recommendation() from public, anon, authenticated;

drop trigger if exists outfit_request_recommendations_require_valid_target on public.outfit_request_recommendations;
create trigger outfit_request_recommendations_require_valid_target
  before insert or update on public.outfit_request_recommendations
  for each row execute procedure public.require_valid_outfit_request_recommendation();

create or replace function public.require_valid_released_outfit_request()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status in ('replied', 'closed') and exists (
    select 1
    from public.outfit_request_recommendations as r
    left join public.looks as l on l.id = r.look_id
    left join public.products as p on p.id = r.product_id
    where r.request_id = new.id
      and (
        (r.target_type = 'look' and (l.id is null or l.status <> 'published' or l.published_at is null or l.published_at > now()))
        or
        (r.target_type = 'product' and (p.id is null or p.status <> 'published' or p.published_at is null or p.published_at > now()))
      )
  ) then
    raise exception 'Ganti rekomendasi yang belum published sebelum mengirim jawaban ke member.';
  end if;

  return new;
end;
$$;

revoke all on function public.require_valid_released_outfit_request() from public, anon, authenticated;

drop trigger if exists outfit_requests_require_valid_release on public.outfit_requests;
create trigger outfit_requests_require_valid_release
  before insert or update of status on public.outfit_requests
  for each row execute procedure public.require_valid_released_outfit_request();

-- Do not let a published catalogue entry disappear from an answer already sent to a member.
create or replace function public.prevent_hiding_outfit_request_look()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.outfit_request_recommendations as r
    join public.outfit_requests as q on q.id = r.request_id
    where r.look_id = new.id
      and q.status in ('replied', 'closed')
      and (
        new.status <> 'published'
        or new.published_at is null
        or new.published_at > now()
      )
  ) then
    raise exception 'Ganti rekomendasi request terkait sebelum menyembunyikan look ini.';
  end if;

  return new;
end;
$$;

create or replace function public.prevent_hiding_outfit_request_product()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.outfit_request_recommendations as r
    join public.outfit_requests as q on q.id = r.request_id
    where r.product_id = new.id
      and q.status in ('replied', 'closed')
      and (
        new.status <> 'published'
        or new.published_at is null
        or new.published_at > now()
      )
  ) then
    raise exception 'Ganti rekomendasi request terkait sebelum menyembunyikan produk ini.';
  end if;

  return new;
end;
$$;

revoke all on function public.prevent_hiding_outfit_request_look() from public, anon, authenticated;
revoke all on function public.prevent_hiding_outfit_request_product() from public, anon, authenticated;

drop trigger if exists looks_prevent_hiding_outfit_request_recommendation on public.looks;
create trigger looks_prevent_hiding_outfit_request_recommendation
  before update of status, published_at on public.looks
  for each row execute procedure public.prevent_hiding_outfit_request_look();

drop trigger if exists products_prevent_hiding_outfit_request_recommendation on public.products;
create trigger products_prevent_hiding_outfit_request_recommendation
  before update of status, published_at on public.products
  for each row execute procedure public.prevent_hiding_outfit_request_product();

alter table public.user_preferences enable row level security;
alter table public.outfit_request_admin_notes enable row level security;
alter table public.outfit_request_recommendations enable row level security;

drop policy if exists "Members read own SISIP profile" on public.profiles;
create policy "Members read own SISIP profile"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

drop policy if exists "Members update own SISIP profile" on public.profiles;
create policy "Members update own SISIP profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists "Members read own preferences" on public.user_preferences;
create policy "Members read own preferences"
  on public.user_preferences for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Members create own preferences" on public.user_preferences;
create policy "Members create own preferences"
  on public.user_preferences for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Members update own preferences" on public.user_preferences;
create policy "Members update own preferences"
  on public.user_preferences for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "SISIP admin manages member preferences" on public.user_preferences;
create policy "SISIP admin manages member preferences"
  on public.user_preferences for all
  to authenticated
  using ((select private.is_sisip_admin()))
  with check ((select private.is_sisip_admin()));

drop policy if exists "Members read own outfit requests" on public.outfit_requests;
create policy "Members read own outfit requests"
  on public.outfit_requests for select
  to authenticated
  using (requester_id = (select auth.uid()));

drop policy if exists "Members create own outfit requests" on public.outfit_requests;
create policy "Members create own outfit requests"
  on public.outfit_requests for insert
  to authenticated
  with check (
    requester_id = (select auth.uid())
    and status = 'new'
    and response_message is null
    and responded_at is null
  );

drop policy if exists "SISIP admin manages outfit requests" on public.outfit_requests;
create policy "SISIP admin manages outfit requests"
  on public.outfit_requests for all
  to authenticated
  using ((select private.is_sisip_admin()))
  with check ((select private.is_sisip_admin()));

drop policy if exists "SISIP admin manages outfit request notes" on public.outfit_request_admin_notes;
create policy "SISIP admin manages outfit request notes"
  on public.outfit_request_admin_notes for all
  to authenticated
  using ((select private.is_sisip_admin()))
  with check ((select private.is_sisip_admin()));

drop policy if exists "Members read released outfit request recommendations" on public.outfit_request_recommendations;
create policy "Members read released outfit request recommendations"
  on public.outfit_request_recommendations for select
  to authenticated
  using (
    exists (
      select 1
      from public.outfit_requests as q
      where q.id = request_id
        and q.requester_id = (select auth.uid())
        and q.status in ('replied', 'closed')
    )
    and (
      (target_type = 'look' and exists (
        select 1 from public.looks as l
        where l.id = look_id and l.status = 'published' and l.published_at <= now()
      ))
      or
      (target_type = 'product' and exists (
        select 1 from public.products as p
        where p.id = product_id and p.status = 'published' and p.published_at <= now()
      ))
    )
  );

drop policy if exists "SISIP admin manages outfit request recommendations" on public.outfit_request_recommendations;
create policy "SISIP admin manages outfit request recommendations"
  on public.outfit_request_recommendations for all
  to authenticated
  using ((select private.is_sisip_admin()))
  with check ((select private.is_sisip_admin()));

revoke all on table
  public.profiles,
  public.user_preferences,
  public.outfit_requests,
  public.outfit_request_admin_notes,
  public.outfit_request_recommendations
from public, anon, authenticated;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table
  public.profiles,
  public.user_preferences,
  public.outfit_requests,
  public.outfit_request_admin_notes,
  public.outfit_request_recommendations
to authenticated;
