-- Keep Phase 5 saves fully subject to RLS, including the default collection.

drop policy if exists "Members create own COMOOTD collections" on public.comootd_collections;
create policy "Members create own COMOOTD collections"
  on public.comootd_collections for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (
      not is_default
      or (
        is_default
        and btrim(name) = 'Disimpan'
        and not exists (
          select 1 from public.comootd_collections existing
          where existing.user_id = (select auth.uid()) and existing.is_default
        )
      )
    )
  );

drop policy if exists "Members save published COMOOTD items" on public.comootd_saved_items;
create policy "Members save published COMOOTD items"
  on public.comootd_saved_items for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.comootd_collections c
      where c.id = collection_id and c.user_id = (select auth.uid())
    )
    and (
      (
        target_type = 'look'
        and exists (
          select 1 from public.looks l
          where l.id = target_id and l.status = 'published' and l.published_at <= now()
        )
      )
      or (
        target_type = 'product'
        and exists (
          select 1 from public.products p
          where p.id = target_id and p.status = 'published' and p.published_at <= now() and p.is_available
        )
      )
    )
  );

drop policy if exists "Members remove own COMOOTD saved items" on public.comootd_saved_items;
create policy "Members remove own COMOOTD saved items"
  on public.comootd_saved_items for delete to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.toggle_comootd_saved_item(
  p_target_type text,
  p_target_id uuid,
  p_collection_id uuid default null
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_collection_id uuid := p_collection_id;
  v_removed boolean := false;
begin
  if v_user_id is null then raise exception 'Masuk terlebih dahulu untuk menyimpan item.'; end if;
  if p_target_type not in ('look', 'product') then raise exception 'Jenis item belum valid.'; end if;
  if p_target_type = 'look' and not exists (
    select 1 from public.looks l where l.id = p_target_id and l.status = 'published' and l.published_at <= now()
  ) then raise exception 'Look tidak tersedia untuk disimpan.'; end if;
  if p_target_type = 'product' and not exists (
    select 1 from public.products p where p.id = p_target_id and p.status = 'published' and p.published_at <= now() and p.is_available
  ) then raise exception 'Produk tidak tersedia untuk disimpan.'; end if;

  if v_collection_id is null then
    select c.id into v_collection_id
    from public.comootd_collections c
    where c.user_id = v_user_id and c.is_default
    limit 1;
    if v_collection_id is null then
      insert into public.comootd_collections (user_id, name, is_default)
      values (v_user_id, 'Disimpan', true)
      returning id into v_collection_id;
    end if;
  elsif not exists (
    select 1 from public.comootd_collections c where c.id = v_collection_id and c.user_id = v_user_id
  ) then
    raise exception 'Koleksi tidak tersedia.';
  end if;

  delete from public.comootd_saved_items si
  where si.collection_id = v_collection_id
    and si.user_id = v_user_id
    and si.target_type = p_target_type
    and si.target_id = p_target_id
  returning true into v_removed;
  if v_removed then return false; end if;

  insert into public.comootd_saved_items (collection_id, user_id, target_type, target_id)
  values (v_collection_id, v_user_id, p_target_type, p_target_id);
  return true;
end;
$$;

revoke all on table public.comootd_saved_items from public, anon, authenticated;
grant select, insert, delete on table public.comootd_saved_items to authenticated;
