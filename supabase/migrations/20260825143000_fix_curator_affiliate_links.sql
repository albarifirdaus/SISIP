-- Fix the initial Curator URL regex on already-migrated projects.
-- E-strings make the regex escape sequence explicit under PostgreSQL's
-- standard_conforming_strings setting.
alter table public.look_curation_items
  drop constraint if exists look_curation_items_affiliate_url_check;

alter table public.look_curation_items
  add constraint look_curation_items_affiliate_url_check
  check (
    lower(affiliate_url) ~ E'^https://([a-z0-9-]+\\.)*shopee\\.co\\.id(/|$)'
    or lower(affiliate_url) ~ E'^https://shope\\.ee(/|$)'
  );

-- Social rows are public only through an active Curator profile. Match that
-- public boundary on direct mutations too; normal saves still work through the
-- Curator profile editor.
drop policy if exists "Curators create own social links" on public.contributor_social_links;
create policy "Curators create own social links"
  on public.contributor_social_links for insert
  to authenticated
  with check (
    contributor_id = (select auth.uid())
    and (select private.is_active_comootd_curator())
  );

drop policy if exists "Curators update own social links" on public.contributor_social_links;
create policy "Curators update own social links"
  on public.contributor_social_links for update
  to authenticated
  using (
    contributor_id = (select auth.uid())
    and (select private.is_active_comootd_curator())
  )
  with check (
    contributor_id = (select auth.uid())
    and (select private.is_active_comootd_curator())
  );

drop policy if exists "Curators delete own social links" on public.contributor_social_links;
create policy "Curators delete own social links"
  on public.contributor_social_links for delete
  to authenticated
  using (
    contributor_id = (select auth.uid())
    and (select private.is_active_comootd_curator())
  );
