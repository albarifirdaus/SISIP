-- SISIP initial schema
-- Apply this whole file in Supabase Dashboard > SQL Editor > New query.
-- This migration creates a cloud database, one-admin security model, and media storage.

create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- Authorization lives in auth.users, never in user-editable metadata.
create or replace function private.is_sisip_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users as u
    where u.id = auth.uid()
      and pg_catalog.lower(u.email) = 'albarifirdaus209@gmail.com'
  );
$$;

revoke all on function private.is_sisip_admin() from public;
grant execute on function private.is_sisip_admin() to authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(btrim(name)) between 1 and 160),
  brand text,
  affiliate_platform text not null default 'shopee' check (affiliate_platform = 'shopee'),
  affiliate_url text not null check (lower(affiliate_url) ~ '^https://([a-z0-9-]+\.)*shopee\.co\.id(/|$)'),
  affiliate_product_id text,
  price_idr integer check (price_idr is null or price_idr >= 0),
  compare_at_price_idr integer check (compare_at_price_idr is null or compare_at_price_idr >= 0),
  price_source text not null default 'manual' check (price_source in ('manual', 'affiliate_api')),
  price_checked_at timestamptz,
  item_type text,
  gender_target text not null default 'unisex' check (gender_target in ('pria', 'wanita', 'unisex')),
  style_tags text[] not null default '{}',
  badges text[] not null default '{}',
  cover_image_path text,
  is_available boolean not null default true,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  is_featured boolean not null default false,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'published' or published_at is not null)
);

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  -- Variants can leave with an unused product. A look item still uses RESTRICT
  -- below, so a product that appears in a published look cannot be deleted.
  product_id uuid not null references public.products(id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 80),
  color_name text,
  color_hex text check (color_hex is null or color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  image_path text,
  is_active boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_variants_product_label_key unique (product_id, label)
);

create table if not exists public.looks (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  excerpt text,
  cover_image_path text,
  cover_alt_text text,
  tone text not null default 'carbon' check (tone in ('carbon', 'clay', 'mineral', 'olive', 'midnight')),
  gender_target text not null default 'unisex' check (gender_target in ('pria', 'wanita', 'unisex')),
  style_tags text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  is_featured boolean not null default false,
  popularity integer not null default 0 check (popularity >= 0),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'published' or published_at is not null)
);

create table if not exists public.look_items (
  id uuid primary key default gen_random_uuid(),
  look_id uuid not null references public.looks(id) on delete cascade,
  product_variant_id uuid not null references public.product_variants(id) on delete restrict,
  position smallint not null check (position between 1 and 5),
  created_at timestamptz not null default now(),
  constraint look_items_look_position_key unique (look_id, position) deferrable initially immediate,
  constraint look_items_look_variant_key unique (look_id, product_variant_id)
);

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(btrim(title)) between 1 and 180),
  excerpt text,
  body_markdown text not null default '',
  cover_image_path text,
  cover_alt_text text,
  style_tags text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  author_id uuid references public.profiles(id) on delete set null,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'published' or (published_at is not null and char_length(btrim(body_markdown)) > 0))
);

create table if not exists public.outfit_requests (
  id uuid primary key default gen_random_uuid(),
  requester_name text,
  requester_email text,
  gender_target text check (gender_target is null or gender_target in ('pria', 'wanita', 'unisex')),
  occasion text,
  style_tags text[] not null default '{}',
  budget_min_idr integer check (budget_min_idr is null or budget_min_idr >= 0),
  budget_max_idr integer check (budget_max_idr is null or budget_max_idr >= 0),
  preferred_colors text,
  message text not null check (char_length(btrim(message)) between 1 and 3000),
  status text not null default 'new' check (status in ('new', 'reviewing', 'replied', 'closed', 'spam')),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (budget_min_idr is null or budget_max_idr is null or budget_max_idr >= budget_min_idr)
);

-- A profile is created whenever the single admin creates a Supabase Auth user.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', 'SISIP Admin'))
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

drop trigger if exists sisip_on_auth_user_created on auth.users;
create trigger sisip_on_auth_user_created
  after insert on auth.users
  for each row execute procedure private.handle_new_user();

-- Also cover the case where the admin user existed before this migration ran.
insert into public.profiles (id, display_name)
select u.id, coalesce(u.raw_user_meta_data ->> 'display_name', 'SISIP Admin')
from auth.users as u
where pg_catalog.lower(u.email) = 'albarifirdaus209@gmail.com'
on conflict (id) do nothing;

drop trigger if exists profiles_set_updated_at on public.profiles;
drop trigger if exists products_set_updated_at on public.products;
drop trigger if exists product_variants_set_updated_at on public.product_variants;
drop trigger if exists looks_set_updated_at on public.looks;
drop trigger if exists articles_set_updated_at on public.articles;
drop trigger if exists outfit_requests_set_updated_at on public.outfit_requests;

create trigger profiles_set_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();
create trigger products_set_updated_at before update on public.products for each row execute procedure public.set_updated_at();
create trigger product_variants_set_updated_at before update on public.product_variants for each row execute procedure public.set_updated_at();
create trigger looks_set_updated_at before update on public.looks for each row execute procedure public.set_updated_at();
create trigger articles_set_updated_at before update on public.articles for each row execute procedure public.set_updated_at();
create trigger outfit_requests_set_updated_at before update on public.outfit_requests for each row execute procedure public.set_updated_at();

-- A published look must have between two and five items.
create or replace function public.require_valid_published_look()
returns trigger
language plpgsql
set search_path = ''
as $$
declare item_count integer;
begin
  if new.status = 'published' then
    select count(*) into item_count from public.look_items where look_id = new.id;
    if item_count < 2 or item_count > 5 then
      raise exception 'A published look must contain 2 to 5 items.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists looks_require_valid_items on public.looks;
create trigger looks_require_valid_items
  before insert or update of status on public.looks
  for each row execute procedure public.require_valid_published_look();

create or replace function public.prevent_invalid_published_look_items()
returns trigger
language plpgsql
set search_path = ''
as $$
declare affected_look uuid;
declare item_count integer;
begin
  affected_look := coalesce(old.look_id, new.look_id);
  if exists (select 1 from public.looks where id = affected_look and status = 'published') then
    select count(*) into item_count from public.look_items where look_id = affected_look;
    if item_count < 2 or item_count > 5 then
      raise exception 'A published look must contain 2 to 5 items.';
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists look_items_keep_published_valid on public.look_items;
create constraint trigger look_items_keep_published_valid
  after insert or update or delete on public.look_items
  deferrable initially deferred
  for each row execute procedure public.prevent_invalid_published_look_items();

create index if not exists products_public_browse_idx on public.products (gender_target, published_at desc) where status = 'published';
create index if not exists products_style_tags_gin_idx on public.products using gin (style_tags);
create index if not exists products_badges_gin_idx on public.products using gin (badges);
create index if not exists product_variants_product_active_idx on public.product_variants (product_id, is_active, sort_order);
create index if not exists looks_public_browse_idx on public.looks (gender_target, published_at desc) where status = 'published';
create index if not exists looks_style_tags_gin_idx on public.looks using gin (style_tags);
create index if not exists look_items_variant_idx on public.look_items (product_variant_id);
create index if not exists articles_public_browse_idx on public.articles (published_at desc) where status = 'published';
create index if not exists articles_style_tags_gin_idx on public.articles using gin (style_tags);
create index if not exists outfit_requests_queue_idx on public.outfit_requests (status, created_at desc);

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.looks enable row level security;
alter table public.look_items enable row level security;
alter table public.articles enable row level security;
alter table public.outfit_requests enable row level security;

drop policy if exists "Public reads published products" on public.products;
create policy "Public reads published products" on public.products for select to anon, authenticated
  using (status = 'published' and published_at <= now());

drop policy if exists "Public reads active variants of published products" on public.product_variants;
create policy "Public reads active variants of published products" on public.product_variants for select to anon, authenticated
  using (is_active and exists (
    select 1 from public.products as p
    where p.id = product_id and p.status = 'published' and p.published_at <= now()
  ));

drop policy if exists "Public reads published looks" on public.looks;
create policy "Public reads published looks" on public.looks for select to anon, authenticated
  using (status = 'published' and published_at <= now());

drop policy if exists "Public reads items for published looks" on public.look_items;
create policy "Public reads items for published looks" on public.look_items for select to anon, authenticated
  using (exists (
    select 1 from public.looks as l
    where l.id = look_id and l.status = 'published' and l.published_at <= now()
  ));

drop policy if exists "Public reads published articles" on public.articles;
create policy "Public reads published articles" on public.articles for select to anon, authenticated
  using (status = 'published' and published_at <= now());

drop policy if exists "SISIP admin manages profiles" on public.profiles;
create policy "SISIP admin manages profiles" on public.profiles for all to authenticated
  using ((select private.is_sisip_admin())) with check ((select private.is_sisip_admin()));

drop policy if exists "SISIP admin manages products" on public.products;
create policy "SISIP admin manages products" on public.products for all to authenticated
  using ((select private.is_sisip_admin())) with check ((select private.is_sisip_admin()));

drop policy if exists "SISIP admin manages product variants" on public.product_variants;
create policy "SISIP admin manages product variants" on public.product_variants for all to authenticated
  using ((select private.is_sisip_admin())) with check ((select private.is_sisip_admin()));

drop policy if exists "SISIP admin manages looks" on public.looks;
create policy "SISIP admin manages looks" on public.looks for all to authenticated
  using ((select private.is_sisip_admin())) with check ((select private.is_sisip_admin()));

drop policy if exists "SISIP admin manages look items" on public.look_items;
create policy "SISIP admin manages look items" on public.look_items for all to authenticated
  using ((select private.is_sisip_admin())) with check ((select private.is_sisip_admin()));

drop policy if exists "SISIP admin manages articles" on public.articles;
create policy "SISIP admin manages articles" on public.articles for all to authenticated
  using ((select private.is_sisip_admin())) with check ((select private.is_sisip_admin()));

drop policy if exists "SISIP admin manages outfit requests" on public.outfit_requests;
create policy "SISIP admin manages outfit requests" on public.outfit_requests for all to authenticated
  using ((select private.is_sisip_admin())) with check ((select private.is_sisip_admin()));

-- Explicit grants complement RLS. The browser only gets public read access.
revoke all on table public.profiles, public.products, public.product_variants, public.looks, public.look_items, public.articles, public.outfit_requests from public, anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.products, public.product_variants, public.looks, public.look_items, public.articles to anon, authenticated;
grant select, insert, update, delete on public.profiles, public.products, public.product_variants, public.looks, public.look_items, public.articles, public.outfit_requests to authenticated;

-- Public-read image bucket. Upload, replace, and deletion are admin-only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sisip-media',
  'sisip-media',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "SISIP admin selects media" on storage.objects;
create policy "SISIP admin selects media" on storage.objects for select to authenticated
  using (bucket_id = 'sisip-media' and (select private.is_sisip_admin()));

drop policy if exists "SISIP admin uploads media" on storage.objects;
create policy "SISIP admin uploads media" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'sisip-media'
    and (select private.is_sisip_admin())
    and (storage.foldername(name))[1] in ('products', 'looks', 'articles')
  );

drop policy if exists "SISIP admin updates media" on storage.objects;
create policy "SISIP admin updates media" on storage.objects for update to authenticated
  using (bucket_id = 'sisip-media' and (select private.is_sisip_admin()))
  with check (
    bucket_id = 'sisip-media'
    and (select private.is_sisip_admin())
    and (storage.foldername(name))[1] in ('products', 'looks', 'articles')
  );

drop policy if exists "SISIP admin deletes media" on storage.objects;
create policy "SISIP admin deletes media" on storage.objects for delete to authenticated
  using (bucket_id = 'sisip-media' and (select private.is_sisip_admin()));

