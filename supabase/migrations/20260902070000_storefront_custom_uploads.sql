alter table public.comootd_storefront_visuals
  add column if not exists custom_image_path text;

alter table public.comootd_storefront_visuals
  drop constraint if exists comootd_storefront_visuals_custom_image_path_check;
alter table public.comootd_storefront_visuals
  add constraint comootd_storefront_visuals_custom_image_path_check check (
    custom_image_path is null
    or custom_image_path ~ '^storefront/(looks|products|curators|journal)/[A-Za-z0-9._-]+$'
  );

revoke update on table public.comootd_storefront_visuals from authenticated;
grant update (look_id, product_id, curator_id, article_id, custom_image_path, focal_position)
  on table public.comootd_storefront_visuals to authenticated;

drop policy if exists "COMOOTD admin uploads storefront media" on storage.objects;
create policy "COMOOTD admin uploads storefront media"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'sisip-media'
    and (select private.is_sisip_admin())
    and (storage.foldername(name))[1] = 'storefront'
    and (storage.foldername(name))[2] in ('looks', 'products', 'curators', 'journal')
  );

drop policy if exists "COMOOTD admin updates storefront media" on storage.objects;
create policy "COMOOTD admin updates storefront media"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'sisip-media'
    and (select private.is_sisip_admin())
    and (storage.foldername(name))[1] = 'storefront'
    and (storage.foldername(name))[2] in ('looks', 'products', 'curators', 'journal')
  )
  with check (
    bucket_id = 'sisip-media'
    and (select private.is_sisip_admin())
    and (storage.foldername(name))[1] = 'storefront'
    and (storage.foldername(name))[2] in ('looks', 'products', 'curators', 'journal')
  );

