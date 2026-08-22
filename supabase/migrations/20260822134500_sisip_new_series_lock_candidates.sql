-- Lock all chosen looks while validating and assigning them to New Series.
-- This prevents a concurrent archive/unpublish from slipping between validation
-- and the slot update.

create or replace function public.set_sisip_new_series(p_look_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  eligible_count integer;
  changed_count integer;
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

  perform 1
  from public.new_series_slots
  where slot between 1 and 5
  order by slot
  for update;

  with locked_looks as (
    select l.id, l.status, l.published_at
    from public.looks as l
    where l.id = any(p_look_ids)
    for update
  )
  select count(*)
  into eligible_count
  from locked_looks
  where status = 'published'
    and published_at <= now();

  if eligible_count <> 5 then
    raise exception 'All New Series looks must be published and currently visible.';
  end if;

  update public.new_series_slots
  set look_id = null
  where slot between 1 and 5
    and look_id is not null;

  update public.new_series_slots as slot_row
  set look_id = selection.look_id
  from pg_catalog.unnest(p_look_ids) with ordinality as selection(look_id, slot)
  where slot_row.slot = selection.slot::smallint;

  get diagnostics changed_count = row_count;
  if changed_count <> 5 then
    raise exception 'New Series slots are not initialized correctly.';
  end if;
end;
$$;

revoke all on function public.set_sisip_new_series(uuid[]) from public, anon, authenticated;
grant execute on function public.set_sisip_new_series(uuid[]) to authenticated;

