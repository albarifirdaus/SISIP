create table if not exists public.comootd_storefront_visuals (
  card_key text primary key check (card_key in ('looks', 'products', 'curators', 'journal')),
  look_id uuid references public.looks(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  curator_id uuid references public.curator_profiles(user_id) on delete set null,
  article_id uuid references public.articles(id) on delete set null,
  focal_position text not null default 'center' check (focal_position in ('center', 'top', 'bottom', 'left', 'right')),
  updated_at timestamptz not null default now(),
  constraint comootd_storefront_visuals_source_check check (
    num_nonnulls(look_id, product_id, curator_id, article_id) = 0
    or (card_key = 'looks' and look_id is not null and product_id is null and curator_id is null and article_id is null)
    or (card_key = 'products' and product_id is not null and look_id is null and curator_id is null and article_id is null)
    or (card_key = 'curators' and curator_id is not null and look_id is null and product_id is null and article_id is null)
    or (card_key = 'journal' and article_id is not null and look_id is null and product_id is null and curator_id is null)
  )
);

insert into public.comootd_storefront_visuals (card_key)
values ('looks'), ('products'), ('curators'), ('journal')
on conflict (card_key) do nothing;

create index if not exists comootd_storefront_visuals_look_idx
  on public.comootd_storefront_visuals (look_id) where look_id is not null;
create index if not exists comootd_storefront_visuals_product_idx
  on public.comootd_storefront_visuals (product_id) where product_id is not null;
create index if not exists comootd_storefront_visuals_curator_idx
  on public.comootd_storefront_visuals (curator_id) where curator_id is not null;
create index if not exists comootd_storefront_visuals_article_idx
  on public.comootd_storefront_visuals (article_id) where article_id is not null;

drop trigger if exists comootd_storefront_visuals_set_updated_at on public.comootd_storefront_visuals;
create trigger comootd_storefront_visuals_set_updated_at
  before update on public.comootd_storefront_visuals
  for each row execute procedure public.set_updated_at();

alter table public.comootd_storefront_visuals enable row level security;

drop policy if exists "Public reads COMOOTD storefront visuals" on public.comootd_storefront_visuals;
create policy "Public reads COMOOTD storefront visuals"
  on public.comootd_storefront_visuals for select
  to anon, authenticated
  using (true);

drop policy if exists "COMOOTD admin updates storefront visuals" on public.comootd_storefront_visuals;
create policy "COMOOTD admin updates storefront visuals"
  on public.comootd_storefront_visuals for update
  to authenticated
  using ((select private.is_sisip_admin()))
  with check ((select private.is_sisip_admin()));

revoke all on table public.comootd_storefront_visuals from public, anon, authenticated;
grant select on table public.comootd_storefront_visuals to anon, authenticated;
grant update (look_id, product_id, curator_id, article_id, focal_position)
  on table public.comootd_storefront_visuals to authenticated;
