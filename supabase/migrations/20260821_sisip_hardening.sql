-- SISIP security and catalogue consistency hardening.
-- Apply this after 20260821_sisip_initial.sql.

-- Trigger functions do not need to be callable directly by browser roles.
revoke all on function private.handle_new_user() from public, anon, authenticated;

-- Supabase owns auth.users, so an existing trigger from an older migration
-- cannot be renamed here. Fresh installations use the SISIP-specific name.

-- Products are Shopee Indonesia affiliate products only. The client validates
-- the same rule, but the database is the final authority.
alter table public.products drop constraint if exists products_affiliate_url_check;
alter table public.products drop constraint if exists products_affiliate_url_shopee_check;
alter table public.products add constraint products_affiliate_url_shopee_check
  check (lower(affiliate_url) ~ '^https://([a-z0-9-]+\.)*shopee\.co\.id(/|$)');

-- An unused product may be removed together with its variants. A variant used
-- by a look remains protected by look_items.product_variant_id ON DELETE RESTRICT.
alter table public.product_variants drop constraint if exists product_variants_product_id_fkey;
alter table public.product_variants add constraint product_variants_product_id_fkey
  foreign key (product_id) references public.products(id) on delete cascade;

-- Publishing is only allowed after a product has at least one active colour.
create or replace function public.require_valid_published_product()
returns trigger
language plpgsql
set search_path = ''
as $$
declare active_variant_count integer;
begin
  if new.status = 'published' then
    select count(*) into active_variant_count
    from public.product_variants
    where product_id = new.id and is_active;
    if active_variant_count < 1 then
      raise exception 'A published product must contain at least one active variant.';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.require_valid_published_product() from public;
drop trigger if exists products_require_valid_variant on public.products;
create trigger products_require_valid_variant
  before insert or update of status on public.products
  for each row execute procedure public.require_valid_published_product();

-- Do not allow a published look to become incomplete because its product or
-- chosen variant was hidden later.
create or replace function public.prevent_hiding_referenced_catalogue()
returns trigger
language plpgsql
set search_path = ''
as $$
declare is_referenced boolean := false;
begin
  if tg_table_name = 'products' and old.status = 'published' and new.status <> 'published' then
    select exists (
      select 1
      from public.look_items as li
      join public.product_variants as pv on pv.id = li.product_variant_id
      join public.looks as l on l.id = li.look_id
      where pv.product_id = new.id and l.status = 'published'
    ) into is_referenced;
  elsif tg_table_name = 'product_variants' and old.is_active and not new.is_active then
    select exists (
      select 1
      from public.look_items as li
      join public.looks as l on l.id = li.look_id
      where li.product_variant_id = new.id and l.status = 'published'
    ) into is_referenced;
  end if;

  if is_referenced then
    raise exception 'Archive the related published look before hiding this catalogue item.';
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_hiding_referenced_catalogue() from public;
drop trigger if exists products_prevent_hiding_referenced on public.products;
create trigger products_prevent_hiding_referenced
  before update of status on public.products
  for each row execute procedure public.prevent_hiding_referenced_catalogue();

drop trigger if exists variants_prevent_hiding_referenced on public.product_variants;
create trigger variants_prevent_hiding_referenced
  before update of is_active on public.product_variants
  for each row execute procedure public.prevent_hiding_referenced_catalogue();

-- When an item moves between looks, validate both sides. The previous version
-- only considered OLD.look_id and could leave the destination look invalid.
create or replace function public.prevent_invalid_published_look_items()
returns trigger
language plpgsql
set search_path = ''
as $$
declare item_count integer;
begin
  if tg_op <> 'INSERT' and exists (
    select 1 from public.looks where id = old.look_id and status = 'published'
  ) then
    select count(*) into item_count from public.look_items where look_id = old.look_id;
    if item_count < 2 or item_count > 5 then
      raise exception 'A published look must contain 2 to 5 items.';
    end if;
  end if;

  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and new.look_id is distinct from old.look_id) then
    if exists (select 1 from public.looks where id = new.look_id and status = 'published') then
      select count(*) into item_count from public.look_items where look_id = new.look_id;
      if item_count < 2 or item_count > 5 then
        raise exception 'A published look must contain 2 to 5 items.';
      end if;
    end if;
  end if;
  return null;
end;
$$;

revoke all on function public.prevent_invalid_published_look_items() from public;

