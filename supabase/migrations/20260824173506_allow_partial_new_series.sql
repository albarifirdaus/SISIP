-- COMOOTD New Series may contain up to five published looks.
-- Empty slots remain empty and are not exposed on the public homepage.

alter table public.new_series_slots
  drop constraint if exists new_series_slots_look_id_fkey;

alter table public.new_series_slots
  add constraint new_series_slots_look_id_fkey
  foreign key (look_id)
  references public.looks(id)
  on delete set null;

create or replace function public.set_sisip_new_series(p_look_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_count integer;
  eligible_count integer;
  changed_count integer;
begin
  if not (select private.is_sisip_admin()) then
    raise exception 'Only the COMOOTD admin can change New Series.' using errcode = '42501';
  end if;

  if coalesce(pg_catalog.cardinality(p_look_ids), 0) <> 5 then
    raise exception 'New Series must provide exactly five slots.';
  end if;

  select count(*)
  into selected_count
  from pg_catalog.unnest(p_look_ids) as selected(look_id)
  where selected.look_id is not null;

  if (
    select count(distinct selected.look_id)
    from pg_catalog.unnest(p_look_ids) as selected(look_id)
    where selected.look_id is not null
  ) <> selected_count then
    raise exception 'A look can only be used once in New Series.';
  end if;

  perform 1
  from public.new_series_slots
  where slot between 1 and 5
  order by slot
  for update;

  with locked_looks as (
    select l.id, l.status, l.published_at
    from public.looks as l
    where l.id = any(pg_catalog.array_remove(p_look_ids, null))
    for update
  )
  select count(*)
  into eligible_count
  from locked_looks
  where status = 'published'
    and published_at <= now();

  if eligible_count <> selected_count then
    raise exception 'All selected New Series looks must be published and currently visible.';
  end if;

  update public.new_series_slots
  set look_id = null
  where slot between 1 and 5
    and look_id is not null;

  update public.new_series_slots as slot_row
  set look_id = selection.look_id
  from pg_catalog.unnest(p_look_ids) with ordinality as selection(look_id, slot)
  where slot_row.slot = selection.slot::smallint
    and selection.look_id is not null;

  get diagnostics changed_count = row_count;
  if changed_count <> selected_count then
    raise exception 'New Series slots are not initialized correctly.';
  end if;
end;
$$;

revoke all on function public.set_sisip_new_series(uuid[]) from public, anon, authenticated;
grant execute on function public.set_sisip_new_series(uuid[]) to authenticated;
