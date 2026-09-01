-- Phase 7 advisor cleanup: cover foreign keys and avoid duplicate SELECT policies.

create index if not exists product_marketplace_links_created_by_idx
  on public.product_marketplace_links(created_by) where created_by is not null;
create index if not exists curator_item_marketplace_links_created_by_idx
  on public.curator_item_marketplace_links(created_by) where created_by is not null;
create index if not exists comootd_marketplace_link_history_actor_idx
  on public.comootd_marketplace_link_history(actor_id) where actor_id is not null;

drop policy if exists "Published product marketplace links are public"
  on public.product_marketplace_links;
drop policy if exists "Admin reads all product marketplace links"
  on public.product_marketplace_links;
create policy "Published product marketplace links are public"
  on public.product_marketplace_links for select to anon
  using (
    status <> 'disabled' and exists (
      select 1 from public.products p
      where p.id=product_id and p.status='published' and p.published_at<=now()
    )
  );
create policy "Authenticated reads allowed product marketplace links"
  on public.product_marketplace_links for select to authenticated
  using (
    (select private.is_sisip_admin()) or (
      status <> 'disabled' and exists (
        select 1 from public.products p
        where p.id=product_id and p.status='published' and p.published_at<=now()
      )
    )
  );

drop policy if exists "Published curator marketplace links are public"
  on public.curator_item_marketplace_links;
drop policy if exists "Owners and admin read all curator marketplace links"
  on public.curator_item_marketplace_links;
create policy "Published curator marketplace links are public"
  on public.curator_item_marketplace_links for select to anon
  using (
    status <> 'disabled' and exists (
      select 1 from public.look_curation_items i
      join public.looks l on l.id=i.look_id
      where i.id=curator_item_id and l.status='published' and l.published_at<=now()
    )
  );
create policy "Authenticated reads allowed curator marketplace links"
  on public.curator_item_marketplace_links for select to authenticated
  using (
    (select private.is_sisip_admin()) or exists (
      select 1 from public.look_curation_items i
      join public.looks l on l.id=i.look_id
      where i.id=curator_item_id and (
        l.creator_id=(select auth.uid()) or
        (status <> 'disabled' and l.status='published' and l.published_at<=now())
      )
    )
  );
