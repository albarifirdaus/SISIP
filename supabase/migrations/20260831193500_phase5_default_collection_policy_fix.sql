-- Avoid recursive RLS evaluation when the invoker RPC creates "Disimpan".
-- The partial unique index still guarantees one default collection per user.
drop policy if exists "Members create own COMOOTD collections" on public.comootd_collections;
create policy "Members create own COMOOTD collections"
  on public.comootd_collections for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (
      not is_default
      or (is_default and btrim(name) = 'Disimpan')
    )
  );
