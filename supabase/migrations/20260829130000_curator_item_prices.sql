alter table public.look_curation_items
  add column if not exists price_idr integer
  check (price_idr is null or price_idr > 0);

drop policy if exists "Curators update prices on own inline items" on public.look_curation_items;
create policy "Curators update prices on own inline items"
  on public.look_curation_items for update
  to authenticated
  using (
    exists (
      select 1 from public.looks as l
      where l.id = look_curation_items.look_id
        and l.creator_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.looks as l
      where l.id = look_curation_items.look_id
        and l.creator_id = (select auth.uid())
    )
  );

create or replace function public.set_contributor_look_prices(
  p_look_id uuid,
  p_prices integer[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item_count integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Masuk terlebih dahulu untuk menyimpan harga.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.looks as l
    where l.id = p_look_id
      and l.creator_id = (select auth.uid())
  ) then
    raise exception 'Look ini bukan milik akun Curator Anda.' using errcode = '42501';
  end if;

  select count(*) into v_item_count
  from public.look_curation_items as item
  where item.look_id = p_look_id;

  if coalesce(cardinality(p_prices), 0) <> v_item_count
    or exists (select 1 from unnest(p_prices) as price where price is null or price <= 0) then
    raise exception 'Harga setiap produk wajib berupa angka IDR lebih dari nol.';
  end if;

  update public.look_curation_items as item
  set price_idr = supplied.price
  from unnest(p_prices) with ordinality as supplied(price, position)
  where item.look_id = p_look_id
    and item.position = supplied.position;
end;
$$;

revoke all on function public.set_contributor_look_prices(uuid, integer[]) from public, anon;
grant execute on function public.set_contributor_look_prices(uuid, integer[]) to authenticated;
