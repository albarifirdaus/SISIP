-- Admin-configurable preview look for each public Match Your Vibe style.

alter table public.comootd_style_tags
  add column if not exists preview_look_id uuid
  references public.looks(id) on delete set null;

create index if not exists comootd_style_tags_preview_look_idx
  on public.comootd_style_tags (preview_look_id)
  where preview_look_id is not null;

create or replace function public.set_comootd_style_previews(p_assignments jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not (select private.is_sisip_admin()) then
    raise exception 'Hanya admin COMOOTD yang dapat mengatur preview style.' using errcode = '42501';
  end if;

  if p_assignments is null or pg_catalog.jsonb_typeof(p_assignments) <> 'array' then
    raise exception 'Daftar preview style belum valid.';
  end if;

  select count(*) into v_count
  from pg_catalog.jsonb_array_elements(p_assignments);

  if v_count < 1 or v_count > 20 then
    raise exception 'Daftar preview style harus berisi 1 sampai 20 style.';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_assignments) as supplied(value)
    where pg_catalog.jsonb_typeof(supplied.value) <> 'object'
      or coalesce(supplied.value ->> 'tag_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or (
        nullif(supplied.value ->> 'look_id', '') is not null
        and supplied.value ->> 'look_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      )
  ) then
    raise exception 'Salah satu tag atau preview look belum valid.';
  end if;

  if (
    select count(distinct supplied.value ->> 'tag_id')
    from pg_catalog.jsonb_array_elements(p_assignments) as supplied(value)
  ) <> v_count then
    raise exception 'Satu tag style hanya boleh diatur sekali.';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_assignments) as supplied(value)
    left join public.comootd_style_tags as tag
      on tag.id = (supplied.value ->> 'tag_id')::uuid
    left join public.looks as look
      on look.id = nullif(supplied.value ->> 'look_id', '')::uuid
    where tag.id is null
      or not tag.is_active
      or not tag.is_explore_visible
      or (
        nullif(supplied.value ->> 'look_id', '') is not null
        and (
          look.id is null
          or look.status <> 'published'
          or look.published_at > now()
          or not exists (
            select 1
            from pg_catalog.unnest(coalesce(look.style_tags, array[]::text[])) as look_style(value)
            where pg_catalog.lower(pg_catalog.btrim(look_style.value)) = tag.normalized_name
          )
        )
      )
  ) then
    raise exception 'Preview harus memakai Look terbit yang memiliki tag style terkait.';
  end if;

  update public.comootd_style_tags as tag
  set preview_look_id = nullif(supplied.value ->> 'look_id', '')::uuid
  from pg_catalog.jsonb_array_elements(p_assignments) as supplied(value)
  where tag.id = (supplied.value ->> 'tag_id')::uuid;
end;
$$;

revoke all on function public.set_comootd_style_previews(jsonb)
  from public, anon, authenticated;
grant execute on function public.set_comootd_style_previews(jsonb)
  to authenticated;

-- The table was created before Data API grants became opt-in. Keep this
-- migration explicit so the new column remains readable by the public client.
grant select on table public.comootd_style_tags to anon, authenticated;

