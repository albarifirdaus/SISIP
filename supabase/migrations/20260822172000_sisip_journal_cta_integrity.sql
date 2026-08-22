-- Close Journal data-integrity gaps for existing production projects.

alter table public.article_blocks
  drop constraint if exists article_blocks_heading_level_check;

alter table public.article_blocks
  add constraint article_blocks_heading_level_check check (
    (block_type = 'heading' and heading_level is not null and heading_level in (2, 3))
    or (block_type <> 'heading' and heading_level is null)
  );

alter table public.article_blocks
  drop constraint if exists article_blocks_content_shape_check;

alter table public.article_blocks
  add constraint article_blocks_content_shape_check check (
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
  );

create or replace function public.require_valid_article_cta_target()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_article_status text;
  v_article_published_at timestamptz;
  v_target_is_valid boolean;
begin
  select status, published_at
  into v_article_status, v_article_published_at
  from public.articles
  where id = new.article_id;

  if not found then
    raise exception 'Artikel CTA tidak ditemukan.';
  end if;

  if v_article_status <> 'published' then
    return new;
  end if;

  if new.target_type = 'look' then
    select exists (
      select 1 from public.looks
      where id = new.look_id
        and status = 'published'
        and published_at is not null
        and published_at <= v_article_published_at
    ) into v_target_is_valid;
  else
    select exists (
      select 1 from public.products
      where id = new.product_id
        and status = 'published'
        and published_at is not null
        and published_at <= v_article_published_at
    ) into v_target_is_valid;
  end if;

  if not coalesce(v_target_is_valid, false) then
    raise exception 'CTA artikel hanya dapat menunjuk look atau produk yang sudah published.';
  end if;

  return new;
end;
$$;

create or replace function public.prevent_hiding_article_cta_look()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.article_ctas as c
    join public.articles as a on a.id = c.article_id
    where c.look_id = new.id
      and a.status = 'published'
      and a.published_at is not null
      and (
        new.status <> 'published'
        or new.published_at is null
        or new.published_at > a.published_at
      )
  ) then
    raise exception 'Hapus atau ganti CTA artikel terkait sebelum menyembunyikan look ini.';
  end if;
  return new;
end;
$$;

create or replace function public.prevent_hiding_article_cta_product()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.article_ctas as c
    join public.articles as a on a.id = c.article_id
    where c.product_id = new.id
      and a.status = 'published'
      and a.published_at is not null
      and (
        new.status <> 'published'
        or new.published_at is null
        or new.published_at > a.published_at
      )
  ) then
    raise exception 'Hapus atau ganti CTA artikel terkait sebelum menyembunyikan produk ini.';
  end if;
  return new;
end;
$$;

revoke all on function public.require_valid_article_cta_target() from public, anon, authenticated;
revoke all on function public.prevent_hiding_article_cta_look() from public, anon, authenticated;
revoke all on function public.prevent_hiding_article_cta_product() from public, anon, authenticated;

drop trigger if exists article_ctas_require_valid_target on public.article_ctas;
create trigger article_ctas_require_valid_target
  before insert or update on public.article_ctas
  for each row execute procedure public.require_valid_article_cta_target();

drop trigger if exists looks_prevent_hiding_article_cta on public.looks;
create trigger looks_prevent_hiding_article_cta
  before update of status, published_at on public.looks
  for each row execute procedure public.prevent_hiding_article_cta_look();

drop trigger if exists products_prevent_hiding_article_cta on public.products;
create trigger products_prevent_hiding_article_cta
  before update of status, published_at on public.products
  for each row execute procedure public.prevent_hiding_article_cta_product();

