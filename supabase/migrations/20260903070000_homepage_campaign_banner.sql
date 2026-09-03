alter table public.comootd_storefront_visuals
  drop constraint if exists comootd_storefront_visuals_card_key_check;
alter table public.comootd_storefront_visuals
  add constraint comootd_storefront_visuals_card_key_check
  check (card_key in ('looks', 'products', 'curators', 'journal', 'campaign'));

alter table public.comootd_storefront_visuals
  add column if not exists campaign_link text,
  add column if not exists campaign_alt_text text,
  add column if not exists campaign_enabled boolean not null default false;

alter table public.comootd_storefront_visuals
  drop constraint if exists comootd_storefront_visuals_custom_image_path_check;
alter table public.comootd_storefront_visuals
  add constraint comootd_storefront_visuals_custom_image_path_check check (
    custom_image_path is null
    or custom_image_path ~ '^storefront/(looks|products|curators|journal|campaign)/[A-Za-z0-9._-]+$'
  );

alter table public.comootd_storefront_visuals
  add constraint comootd_storefront_visuals_campaign_link_check check (
    campaign_link is null
    or (char_length(campaign_link) <= 500 and ((campaign_link like '/%' and campaign_link not like '//%') or campaign_link ~ '^https://'))
  ),
  add constraint comootd_storefront_visuals_campaign_alt_check check (
    campaign_alt_text is null or char_length(campaign_alt_text) <= 240
  ),
  add constraint comootd_storefront_visuals_campaign_fields_check check (
    card_key = 'campaign'
    or (campaign_link is null and campaign_alt_text is null and campaign_enabled = false)
  );

insert into public.comootd_storefront_visuals (
  card_key,
  campaign_link,
  campaign_alt_text,
  campaign_enabled
)
values ('campaign', '/looks', null, false)
on conflict (card_key) do nothing;

revoke update on table public.comootd_storefront_visuals from authenticated;
grant update (
  look_id,
  product_id,
  curator_id,
  article_id,
  custom_image_path,
  focal_position,
  campaign_link,
  campaign_alt_text,
  campaign_enabled
) on table public.comootd_storefront_visuals to authenticated;

drop policy if exists "COMOOTD admin uploads storefront media" on storage.objects;
create policy "COMOOTD admin uploads storefront media"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'sisip-media'
    and (select private.is_sisip_admin())
    and (storage.foldername(name))[1] = 'storefront'
    and (storage.foldername(name))[2] in ('looks', 'products', 'curators', 'journal', 'campaign')
  );

drop policy if exists "COMOOTD admin updates storefront media" on storage.objects;
create policy "COMOOTD admin updates storefront media"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'sisip-media'
    and (select private.is_sisip_admin())
    and (storage.foldername(name))[1] = 'storefront'
    and (storage.foldername(name))[2] in ('looks', 'products', 'curators', 'journal', 'campaign')
  )
  with check (
    bucket_id = 'sisip-media'
    and (select private.is_sisip_admin())
    and (storage.foldername(name))[1] = 'storefront'
    and (storage.foldername(name))[2] in ('looks', 'products', 'curators', 'journal', 'campaign')
  );
