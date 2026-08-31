-- Keep privileged Phase 6 implementations outside the exposed API schema.
-- Public RPCs remain security-invoker wrappers with explicit grants.

alter function public.submit_comootd_curator_application(text, text, text, text, text[], text, text, text, text)
  set schema private;
alter function public.withdraw_comootd_curator_application()
  set schema private;
alter function public.admin_review_comootd_curator_application(uuid, text, text, text, integer)
  set schema private;
alter function public.admin_moderate_comootd_curator(uuid, boolean, integer, text)
  set schema private;
alter function public.mark_comootd_notification_read(uuid)
  set schema private;

revoke all on function private.submit_comootd_curator_application(text, text, text, text, text[], text, text, text, text)
  from public, anon, authenticated;
grant execute on function private.submit_comootd_curator_application(text, text, text, text, text[], text, text, text, text)
  to authenticated;

revoke all on function private.withdraw_comootd_curator_application()
  from public, anon, authenticated;
grant execute on function private.withdraw_comootd_curator_application()
  to authenticated;

revoke all on function private.admin_review_comootd_curator_application(uuid, text, text, text, integer)
  from public, anon, authenticated;
grant execute on function private.admin_review_comootd_curator_application(uuid, text, text, text, integer)
  to authenticated;

revoke all on function private.admin_moderate_comootd_curator(uuid, boolean, integer, text)
  from public, anon, authenticated;
grant execute on function private.admin_moderate_comootd_curator(uuid, boolean, integer, text)
  to authenticated;

revoke all on function private.mark_comootd_notification_read(uuid)
  from public, anon, authenticated;
grant execute on function private.mark_comootd_notification_read(uuid)
  to authenticated;

create or replace function public.submit_comootd_curator_application(
  p_display_name text,
  p_requested_handle text,
  p_contact_email text,
  p_bio text,
  p_profile_tags text[],
  p_instagram_url text,
  p_tiktok_url text,
  p_portfolio_url text,
  p_motivation text
)
returns public.curator_applications
language sql
security invoker
set search_path = ''
as $$
  select private.submit_comootd_curator_application(
    p_display_name, p_requested_handle, p_contact_email, p_bio,
    p_profile_tags, p_instagram_url, p_tiktok_url, p_portfolio_url, p_motivation
  );
$$;

create or replace function public.withdraw_comootd_curator_application()
returns public.curator_applications
language sql
security invoker
set search_path = ''
as $$ select private.withdraw_comootd_curator_application(); $$;

create or replace function public.admin_review_comootd_curator_application(
  p_application_id uuid,
  p_decision text,
  p_admin_note text,
  p_trust_level text default 'emerging',
  p_active_look_limit integer default 30
)
returns public.curator_applications
language sql
security invoker
set search_path = ''
as $$
  select private.admin_review_comootd_curator_application(
    p_application_id, p_decision, p_admin_note, p_trust_level, p_active_look_limit
  );
$$;

create or replace function public.admin_moderate_comootd_curator(
  p_user_id uuid,
  p_is_active boolean,
  p_active_look_limit integer,
  p_trust_level text
)
returns public.curator_profiles
language sql
security invoker
set search_path = ''
as $$
  select private.admin_moderate_comootd_curator(
    p_user_id, p_is_active, p_active_look_limit, p_trust_level
  );
$$;

create or replace function public.mark_comootd_notification_read(p_notification_id uuid default null)
returns integer
language sql
security invoker
set search_path = ''
as $$ select private.mark_comootd_notification_read(p_notification_id); $$;

revoke all on function public.submit_comootd_curator_application(text, text, text, text, text[], text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.submit_comootd_curator_application(text, text, text, text, text[], text, text, text, text)
  to authenticated;

revoke all on function public.withdraw_comootd_curator_application() from public, anon, authenticated;
grant execute on function public.withdraw_comootd_curator_application() to authenticated;

revoke all on function public.admin_review_comootd_curator_application(uuid, text, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.admin_review_comootd_curator_application(uuid, text, text, text, integer)
  to authenticated;

revoke all on function public.admin_moderate_comootd_curator(uuid, boolean, integer, text)
  from public, anon, authenticated;
grant execute on function public.admin_moderate_comootd_curator(uuid, boolean, integer, text)
  to authenticated;

revoke all on function public.mark_comootd_notification_read(uuid) from public, anon, authenticated;
grant execute on function public.mark_comootd_notification_read(uuid) to authenticated;

notify pgrst, 'reload schema';
