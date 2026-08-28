alter table public.products
  add column if not exists category text not null default 'other';

alter table public.products
  drop constraint if exists products_category_check;

alter table public.products
  add constraint products_category_check
  check (category in ('top','bottom','outerwear','dress','footwear','bag','accessory','hijab','jewelry','other'));

create index if not exists products_category_idx on public.products (category);
