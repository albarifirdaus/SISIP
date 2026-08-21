-- SISIP bulk catalogue import and trigger correction.
-- Apply after the existing 20260821 SISIP migrations.

-- A stable import key lets CSV/XLSX re-imports update the same product safely.
-- PostgreSQL unique constraints allow multiple NULL values, so individually
-- created products remain unaffected.
alter table public.products
  add column if not exists import_key text;

alter table public.products
  drop constraint if exists products_import_key_format_check;

alter table public.products
  add constraint products_import_key_format_check
  check (import_key is null or import_key ~ '^[A-Z0-9][A-Z0-9_-]{0,79}$');

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.products'::regclass
      and conname = 'products_import_key_key'
  ) then
    alter table public.products
      add constraint products_import_key_key unique (import_key);
  end if;
end;
$$;

-- Shopee Affiliate short links use shope.ee, while full product links use
-- shopee.co.id. Keep both forms accepted by the database.
alter table public.products
  drop constraint if exists products_affiliate_url_check;

alter table public.products
  drop constraint if exists products_affiliate_url_shopee_check;

alter table public.products
  add constraint products_affiliate_url_shopee_check
  check (
    lower(affiliate_url) ~ '^https://([a-z0-9-]+\.)*shopee\.co\.id(/|$)'
    or lower(affiliate_url) ~ '^https://shope\.ee(/|$)'
  );

-- The old polymorphic trigger ran on products and variants. PL/pgSQL binds
-- OLD to the current table row type, so OLD.is_active fails on products.
-- Keep one typed function per table to make that impossible.
create or replace function public.prevent_hiding_referenced_product()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'published' and new.status <> 'published' and exists (
    select 1
    from public.look_items as li
    join public.product_variants as pv on pv.id = li.product_variant_id
    join public.looks as l on l.id = li.look_id
    where pv.product_id = new.id
      and l.status = 'published'
  ) then
    raise exception 'Archive the related published look before hiding this catalogue item.';
  end if;

  return new;
end;
$$;

create or replace function public.prevent_hiding_referenced_variant()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.is_active and not new.is_active and exists (
    select 1
    from public.look_items as li
    join public.looks as l on l.id = li.look_id
    where li.product_variant_id = new.id
      and l.status = 'published'
  ) then
    raise exception 'Archive the related published look before hiding this catalogue item.';
  end if;

  return new;
end;
$$;

revoke all on function public.prevent_hiding_referenced_product() from public, anon, authenticated;
revoke all on function public.prevent_hiding_referenced_variant() from public, anon, authenticated;

drop trigger if exists products_prevent_hiding_referenced on public.products;
create trigger products_prevent_hiding_referenced
  before update of status on public.products
  for each row execute procedure public.prevent_hiding_referenced_product();

drop trigger if exists variants_prevent_hiding_referenced on public.product_variants;
create trigger variants_prevent_hiding_referenced
  before update of is_active on public.product_variants
  for each row execute procedure public.prevent_hiding_referenced_variant();

drop function if exists public.prevent_hiding_referenced_catalogue();

