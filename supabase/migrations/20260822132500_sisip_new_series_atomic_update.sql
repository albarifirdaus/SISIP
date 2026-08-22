-- Make reordering the five unique look slots safe when two existing slots swap.
-- A temporary NULL pass avoids an immediate unique-index collision, while the
-- row lock keeps concurrent admin saves serialized in the same transaction.

create or replace function public.set_sisip_new_series(p_look_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  eligible_count integer;
begin
  if not (select private.is_sisip_admin()) then
    raise exception 'Only the SISIP admin can change New Series.' using errcode = '42501';
  end if;

  if coalesce(pg_catalog.cardinality(p_look_ids), 0) <> 5
    or exists (
      select 1
      from pg_catalog.unnest(p_look_ids) as selected(look_id)
      where selected.look_id is null
    ) then
    raise exception 'New Series must contain exactly five looks.';
  end if;

  if (
    select count(distinct selected.look_id)
    from pg_catalog.unnest(p_look_ids) as selected(look_id)
  ) <> 5 then
    raise exception 'New Series cannot contain the same look more than once.';
  end if;

  select count(*)
  into eligible_count
  from public.looks as l
  where l.id = any(p_look_ids)
    and l.status = 'published'
    and l.published_at <= now();

  if eligible_count <> 5 then
    raise exception 'All New Series looks must be published and currently visible.';
  end if;

  perform 1
  from public.new_series_slots
  for update;

  update public.new_series_slots
  set look_id = null
  where look_id is not null;

  update public.new_series_slots as slot_row
  set look_id = selection.look_id
  from pg_catalog.unnest(p_look_ids) with ordinality as selection(look_id, slot)
  where slot_row.slot = selection.slot::smallint;
end;
$$;

revoke all on function public.set_sisip_new_series(uuid[]) from public, anon, authenticated;
grant execute on function public.set_sisip_new_series(uuid[]) to authenticated;

