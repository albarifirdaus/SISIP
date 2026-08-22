-- SISIP New Series: five durable, ordered homepage slots.
-- Only the existing SISIP admin can replace the complete series via RPC.

create table if not exists public.new_series_slots (
  slot smallint primary key check (slot between 1 and 5),
  look_id uuid references public.looks(id) on delete restrict,
  updated_at timestamptz not null default now(),
  constraint new_series_slots_look_id_key unique (look_id)
);

insert into public.new_series_slots (slot)
values (1), (2), (3), (4), (5)
on conflict (slot) do nothing;

drop trigger if exists new_series_slots_set_updated_at on public.new_series_slots;
create trigger new_series_slots_set_updated_at
  before update on public.new_series_slots
  for each row execute procedure public.set_updated_at();

alter table public.new_series_slots enable row level security;

drop policy if exists "Public reads populated SISIP New Series slots" on public.new_series_slots;
create policy "Public reads populated SISIP New Series slots"
  on public.new_series_slots for select
  to anon, authenticated
  using (
    look_id is not null
    and exists (
      select 1
      from public.looks as l
      where l.id = look_id
        and l.status = 'published'
        and l.published_at <= now()
    )
  );

drop policy if exists "SISIP admin reads all New Series slots" on public.new_series_slots;
create policy "SISIP admin reads all New Series slots"
  on public.new_series_slots for select
  to authenticated
  using ((select private.is_sisip_admin()));

revoke all on table public.new_series_slots from public, anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on table public.new_series_slots to anon, authenticated;

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

  update public.new_series_slots as slot_row
  set look_id = selection.look_id
  from pg_catalog.unnest(p_look_ids) with ordinality as selection(look_id, slot)
  where slot_row.slot = selection.slot::smallint;
end;
$$;

revoke all on function public.set_sisip_new_series(uuid[]) from public, anon, authenticated;
grant execute on function public.set_sisip_new_series(uuid[]) to authenticated;

create or replace function public.prevent_hiding_new_series_look()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (
    new.status <> 'published'
    or new.published_at is null
    or new.published_at > now()
  ) and exists (
    select 1
    from public.new_series_slots as slot_row
    where slot_row.look_id = new.id
  ) then
    raise exception 'Replace this New Series look before hiding or unpublishing it.';
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_hiding_new_series_look() from public, anon, authenticated;

drop trigger if exists looks_prevent_hiding_new_series on public.looks;
create trigger looks_prevent_hiding_new_series
  before update of status, published_at on public.looks
  for each row execute procedure public.prevent_hiding_new_series_look();

-- Use currently visible looks only for the initial series. Existing slot choices
-- are preserved if this migration is replayed.
with ranked_looks as (
  select
    l.id,
    row_number() over (
      order by l.sort_order desc, l.published_at desc, l.created_at desc
    )::smallint as slot
  from public.looks as l
  where l.status = 'published'
    and l.published_at <= now()
)
update public.new_series_slots as slot_row
set look_id = ranked_looks.id
from ranked_looks
where slot_row.slot = ranked_looks.slot
  and ranked_looks.slot between 1 and 5
  and slot_row.look_id is null;

