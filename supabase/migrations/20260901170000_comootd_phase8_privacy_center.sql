-- COMOOTD Phase 8: privacy preferences and user-controlled data export.
-- Account deletion itself is performed by an authenticated Edge Function so
-- the service-role key never reaches the browser.

create table if not exists public.comootd_privacy_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  analytics_enabled boolean not null default false,
  activity_personalization_enabled boolean not null default false,
  privacy_version text not null,
  terms_version text not null,
  privacy_acknowledged_at timestamptz not null,
  terms_accepted_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint comootd_privacy_version_length check (char_length(privacy_version) between 1 and 40),
  constraint comootd_terms_version_length check (char_length(terms_version) between 1 and 40)
);

alter table public.comootd_privacy_preferences enable row level security;

drop policy if exists "Members manage their own privacy preferences" on public.comootd_privacy_preferences;
create policy "Members manage their own privacy preferences"
on public.comootd_privacy_preferences
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

revoke all on public.comootd_privacy_preferences from anon;
revoke all on public.comootd_privacy_preferences from authenticated;
grant select, insert, update on public.comootd_privacy_preferences to authenticated;

create or replace function public.export_my_comootd_data()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  select jsonb_build_object(
    'schema_version', '2026-09-01',
    'generated_at', now(),
    'profile', (
      select to_jsonb(p) from public.profiles p where p.id = (select auth.uid())
    ),
    'preferences', (
      select to_jsonb(up) from public.user_preferences up where up.user_id = (select auth.uid())
    ),
    'privacy_preferences', (
      select to_jsonb(pp) from public.comootd_privacy_preferences pp where pp.user_id = (select auth.uid())
    ),
    'collections', coalesce((
      select jsonb_agg(to_jsonb(c) || jsonb_build_object(
        'saved_items', coalesce((
          select jsonb_agg(to_jsonb(si) order by si.created_at)
          from public.comootd_saved_items si
          where si.collection_id = c.id and si.user_id = (select auth.uid())
        ), '[]'::jsonb)
      ) order by c.created_at)
      from public.comootd_collections c
      where c.user_id = (select auth.uid())
    ), '[]'::jsonb),
    'curator_follows', coalesce((
      select jsonb_agg(to_jsonb(cf) order by cf.created_at)
      from public.comootd_curator_follows cf
      where cf.follower_id = (select auth.uid())
    ), '[]'::jsonb),
    'look_likes', coalesce((
      select jsonb_agg(to_jsonb(ll) order by ll.created_at)
      from public.look_likes ll
      where ll.user_id = (select auth.uid())
    ), '[]'::jsonb),
    'recently_viewed', coalesce((
      select jsonb_agg(to_jsonb(rv) order by rv.viewed_at desc)
      from public.comootd_recently_viewed rv
      where rv.user_id = (select auth.uid())
    ), '[]'::jsonb),
    'outfit_requests', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.created_at)
      from public.outfit_requests r
      where r.requester_id = (select auth.uid())
    ), '[]'::jsonb),
    'curator_application', (
      select to_jsonb(ca)
      from public.curator_applications ca
      where ca.applicant_id = (select auth.uid())
      order by ca.created_at desc
      limit 1
    ),
    'curator_profile', (
      select to_jsonb(cp) from public.curator_profiles cp where cp.user_id = (select auth.uid())
    ),
    'curator_body_metrics', (
      select to_jsonb(cb) from public.curator_body_metrics cb where cb.user_id = (select auth.uid())
    ),
    'notifications', coalesce((
      select jsonb_agg(to_jsonb(n) order by n.created_at)
      from public.comootd_notifications n
      where n.user_id = (select auth.uid())
    ), '[]'::jsonb)
  )
$function$;

revoke all on function public.export_my_comootd_data() from public;
revoke all on function public.export_my_comootd_data() from anon;
grant execute on function public.export_my_comootd_data() to authenticated;

comment on table public.comootd_privacy_preferences is
  'Explicit member choices for optional analytics and activity-based personalization.';
comment on function public.export_my_comootd_data() is
  'Exports the caller-owned COMOOTD account data under existing RLS policies.';
