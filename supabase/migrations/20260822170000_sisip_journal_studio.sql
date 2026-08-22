-- SISIP Journal Studio: ordered editorial blocks and curated catalogue CTAs.
-- Images are stored in the existing sisip-media/articles/{article_id}/ folder.

alter table public.articles
  add column if not exists category text not null default 'editorial'
    check (category in ('style-guide', 'occasion-guide', 'trend-watch', 'editorial', 'shopping-guide', 'wardrobe-notes'));

create table if not exists public.article_blocks (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  position smallint not null check (position between 1 and 20),
  block_type text not null check (block_type in ('paragraph', 'heading', 'quote', 'image')),
  text_content text,
  heading_level smallint,
  image_path text,
  image_alt_text text,
  caption text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint article_blocks_article_position_key unique (article_id, position),
  constraint article_blocks_heading_level_check check (
    (block_type = 'heading' and heading_level is not null and heading_level in (2, 3))
    or (block_type <> 'heading' and heading_level is null)
  ),
  constraint article_blocks_content_shape_check check (
    (
      block_type = 'paragraph'
      and text_content is not null
      and char_length(btrim(text_content)) between 1 and 6000
      and image_path is null
      and image_alt_text is null
      and caption is null
    )
    or (
      block_type = 'heading'
      and text_content is not null
      and char_length(btrim(text_content)) between 1 and 240
      and image_path is null
      and image_alt_text is null
      and caption is null
    )
    or (
      block_type = 'quote'
      and text_content is not null
      and char_length(btrim(text_content)) between 1 and 800
      and image_path is null
      and image_alt_text is null
      and caption is null
    )
    or (
      block_type = 'image'
      and text_content is null
      and image_path is not null
      and image_path like ('articles/' || article_id::text || '/%')
      and image_alt_text is not null
      and char_length(btrim(image_alt_text)) between 1 and 240
      and (caption is null or char_length(btrim(caption)) between 1 and 500)
    )
  )
);

create table if not exists public.article_ctas (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  position smallint not null check (position between 1 and 6),
  target_type text not null check (target_type in ('look', 'product')),
  look_id uuid references public.looks(id) on delete restrict,
  product_id uuid references public.products(id) on delete restrict,
  label text not null check (char_length(btrim(label)) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint article_ctas_article_position_key unique (article_id, position),
  constraint article_ctas_exactly_one_target_check check (
    (target_type = 'look' and look_id is not null and product_id is null)
    or (target_type = 'product' and product_id is not null and look_id is null)
  )
);

create unique index if not exists article_ctas_article_look_target_key
  on public.article_ctas (article_id, look_id)
  where look_id is not null;

create unique index if not exists article_ctas_article_product_target_key
  on public.article_ctas (article_id, product_id)
  where product_id is not null;

create index if not exists article_blocks_article_position_idx
  on public.article_blocks (article_id, position);

create index if not exists article_ctas_look_id_idx
  on public.article_ctas (look_id)
  where look_id is not null;

create index if not exists article_ctas_product_id_idx
  on public.article_ctas (product_id)
  where product_id is not null;

drop trigger if exists article_blocks_set_updated_at on public.article_blocks;
create trigger article_blocks_set_updated_at
  before update on public.article_blocks
  for each row execute procedure public.set_updated_at();

drop trigger if exists article_ctas_set_updated_at on public.article_ctas;
create trigger article_ctas_set_updated_at
  before update on public.article_ctas
  for each row execute procedure public.set_updated_at();

-- A journal article must only publish with a non-empty fallback body and
-- CTAs pointing to catalogue entries that are already public.
create or replace function public.require_valid_published_article()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status <> 'published' then
    return new;
  end if;

  if new.published_at is null or char_length(btrim(coalesce(new.body_markdown, ''))) = 0 then
    raise exception 'Artikel published harus memiliki isi dan tanggal terbit.';
  end if;

  if exists (
    select 1
    from public.article_ctas as c
    left join public.looks as l on l.id = c.look_id
    left join public.products as p on p.id = c.product_id
    where c.article_id = new.id
      and (
        (c.target_type = 'look' and (l.id is null or l.status <> 'published' or l.published_at is null or l.published_at > new.published_at))
        or
        (c.target_type = 'product' and (p.id is null or p.status <> 'published' or p.published_at is null or p.published_at > new.published_at))
      )
  ) then
    raise exception 'CTA artikel hanya dapat menunjuk look atau produk yang sudah published.';
  end if;

  return new;
end;
$$;

revoke all on function public.require_valid_published_article() from public, anon, authenticated;

drop trigger if exists articles_require_valid_content on public.articles;
create trigger articles_require_valid_content
  before insert or update of status, published_at, body_markdown on public.articles
  for each row execute procedure public.require_valid_published_article();

alter table public.article_blocks enable row level security;
alter table public.article_ctas enable row level security;

drop policy if exists "Public reads blocks for published articles" on public.article_blocks;
create policy "Public reads blocks for published articles"
  on public.article_blocks for select to anon, authenticated
  using (
    exists (
      select 1
      from public.articles as a
      where a.id = article_id
        and a.status = 'published'
        and a.published_at <= now()
    )
  );

drop policy if exists "Public reads CTAs for published articles" on public.article_ctas;
create policy "Public reads CTAs for published articles"
  on public.article_ctas for select to anon, authenticated
  using (
    exists (
      select 1
      from public.articles as a
      where a.id = article_id
        and a.status = 'published'
        and a.published_at <= now()
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

drop policy if exists "SISIP admin manages article blocks" on public.article_blocks;
create policy "SISIP admin manages article blocks"
  on public.article_blocks for all to authenticated
  using ((select private.is_sisip_admin()))
  with check ((select private.is_sisip_admin()));

drop policy if exists "SISIP admin manages article CTAs" on public.article_ctas;
create policy "SISIP admin manages article CTAs"
  on public.article_ctas for all to authenticated
  using ((select private.is_sisip_admin()))
  with check ((select private.is_sisip_admin()));

revoke all on table public.article_blocks, public.article_ctas from public, anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.article_blocks, public.article_ctas to anon, authenticated;
grant select, insert, update, delete on public.article_blocks, public.article_ctas to authenticated;

