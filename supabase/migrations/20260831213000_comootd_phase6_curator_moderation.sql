-- COMOOTD Phase 6: moderated Curator applications, trust levels, and private notifications.

alter table public.curator_profiles
  add column if not exists trust_level text not null default 'emerging'
    check (trust_level in ('emerging', 'verified', 'editorial'));

create table if not exists public.curator_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null unique references public.profiles(id) on delete cascade,
  display_name text not null,
  requested_handle text not null,
  contact_email text not null,
  bio text,
  profile_tags text[] not null default array[]::text[],
  instagram_url text,
  tiktok_url text,
  portfolio_url text,
  motivation text not null,
  status text not null default 'submitted'
    check (status in ('submitted', 'approved', 'rejected', 'withdrawn')),
  admin_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(display_name) between 1 and 80),
  check (requested_handle ~ '^[a-z0-9]+(?:[a-z0-9_-]*[a-z0-9])?$' and char_length(requested_handle) between 3 and 32),
  check (char_length(contact_email) between 3 and 254),
  check (bio is null or char_length(bio) <= 500),
  check (cardinality(profile_tags) <= 5),
  check (char_length(motivation) between 20 and 1200),
  check (admin_note is null or char_length(admin_note) <= 1000)
);

create index if not exists curator_applications_status_submitted_idx
  on public.curator_applications (status, submitted_at desc);

drop trigger if exists curator_applications_set_updated_at on public.curator_applications;
create trigger curator_applications_set_updated_at
  before update on public.curator_applications
  for each row execute procedure public.set_updated_at();

alter table public.curator_applications enable row level security;
revoke all on table public.curator_applications from public, anon, authenticated;
grant select on table public.curator_applications to authenticated;

drop policy if exists "Members read own curator application" on public.curator_applications;
create policy "Members read own curator application"
  on public.curator_applications for select
  to authenticated
  using ((select auth.uid()) = applicant_id);

drop policy if exists "Admins read curator applications" on public.curator_applications;
create policy "Admins read curator applications"
  on public.curator_applications for select
  to authenticated
  using ((select private.is_sisip_admin()));

create table if not exists public.comootd_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('curator_application', 'moderation', 'system')),
  title text not null check (char_length(title) between 1 and 120),
  message text not null check (char_length(message) between 1 and 600),
  action_url text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists comootd_notifications_owner_created_idx
  on public.comootd_notifications (user_id, created_at desc);

alter table public.comootd_notifications enable row level security;
revoke all on table public.comootd_notifications from public, anon, authenticated;
grant select on table public.comootd_notifications to authenticated;

drop policy if exists "Members read own notifications" on public.comootd_notifications;
create policy "Members read own notifications"
  on public.comootd_notifications for select
  to authenticated
  using ((select auth.uid()) = user_id);

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
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_display_name text := pg_catalog.btrim(coalesce(p_display_name, ''));
  v_handle text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_requested_handle, '')));
  v_email text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_contact_email, '')));
  v_bio text := nullif(pg_catalog.btrim(coalesce(p_bio, '')), '');
  v_tags text[];
  v_instagram text := nullif(pg_catalog.btrim(coalesce(p_instagram_url, '')), '');
  v_tiktok text := nullif(pg_catalog.btrim(coalesce(p_tiktok_url, '')), '');
  v_portfolio text := nullif(pg_catalog.btrim(coalesce(p_portfolio_url, '')), '');
  v_motivation text := pg_catalog.btrim(coalesce(p_motivation, ''));
  v_application public.curator_applications%rowtype;
begin
  if v_actor_id is null then
    raise exception 'Masuk terlebih dahulu untuk mengajukan akun Curator.' using errcode = '42501';
  end if;
  if (select private.is_sisip_admin()) then
    raise exception 'Akun admin tidak perlu mengajukan akses Curator.';
  end if;
  if exists (select 1 from public.curator_profiles cp where cp.user_id = v_actor_id and cp.is_active) then
    raise exception 'Akun ini sudah memiliki akses Curator aktif.';
  end if;
  if char_length(v_display_name) not between 1 and 80 then
    raise exception 'Nama tampil wajib diisi dan maksimal 80 karakter.';
  end if;
  if v_handle !~ '^[a-z0-9]+(?:[a-z0-9_-]*[a-z0-9])?$' or char_length(v_handle) not between 3 and 32 then
    raise exception 'Handle harus 3–32 karakter: huruf kecil, angka, _ atau -.';
  end if;
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or char_length(v_email) > 254 then
    raise exception 'Email kontak belum valid.';
  end if;
  if v_bio is not null and char_length(v_bio) > 500 then
    raise exception 'Bio Curator maksimal 500 karakter.';
  end if;
  if char_length(v_motivation) not between 20 and 1200 then
    raise exception 'Alasan pengajuan harus berisi 20–1200 karakter.';
  end if;
  if exists (
    select 1 from public.curator_profiles cp
    where cp.handle = v_handle and cp.user_id <> v_actor_id
  ) or exists (
    select 1 from public.curator_applications ca
    where ca.requested_handle = v_handle and ca.applicant_id <> v_actor_id
      and ca.status in ('submitted', 'approved')
  ) then
    raise exception 'Handle Curator tersebut sudah digunakan atau sedang ditinjau.';
  end if;

  select coalesce(array_agg(cleaned.tag order by cleaned.position), array[]::text[])
  into v_tags
  from (
    select pg_catalog.btrim(supplied.tag) as tag, supplied.position
    from pg_catalog.unnest(coalesce(p_profile_tags, array[]::text[])) with ordinality as supplied(tag, position)
    where pg_catalog.btrim(coalesce(supplied.tag, '')) <> ''
  ) cleaned;
  if not (select private.are_valid_comootd_tags(v_tags, 5, 48)) then
    raise exception 'Tag profil Curator belum valid.';
  end if;

  insert into public.curator_applications (
    applicant_id, display_name, requested_handle, contact_email, bio,
    profile_tags, instagram_url, tiktok_url, portfolio_url, motivation,
    status, admin_note, reviewed_by, submitted_at, reviewed_at
  ) values (
    v_actor_id, v_display_name, v_handle, v_email, v_bio,
    v_tags, v_instagram, v_tiktok, v_portfolio, v_motivation,
    'submitted', null, null, now(), null
  )
  on conflict (applicant_id) do update set
    display_name = excluded.display_name,
    requested_handle = excluded.requested_handle,
    contact_email = excluded.contact_email,
    bio = excluded.bio,
    profile_tags = excluded.profile_tags,
    instagram_url = excluded.instagram_url,
    tiktok_url = excluded.tiktok_url,
    portfolio_url = excluded.portfolio_url,
    motivation = excluded.motivation,
    status = 'submitted',
    admin_note = null,
    reviewed_by = null,
    submitted_at = now(),
    reviewed_at = null
  returning * into v_application;

  update public.profiles set display_name = v_display_name where id = v_actor_id;
  return v_application;
end;
$$;

revoke all on function public.submit_comootd_curator_application(text, text, text, text, text[], text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.submit_comootd_curator_application(text, text, text, text, text[], text, text, text, text)
  to authenticated;

create or replace function public.withdraw_comootd_curator_application()
returns public.curator_applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_application public.curator_applications%rowtype;
begin
  if v_actor_id is null then
    raise exception 'Masuk terlebih dahulu.' using errcode = '42501';
  end if;
  update public.curator_applications
  set status = 'withdrawn', reviewed_at = now()
  where applicant_id = v_actor_id and status = 'submitted'
  returning * into v_application;
  if v_application.id is null then
    raise exception 'Tidak ada pengajuan aktif yang dapat dibatalkan.';
  end if;
  return v_application;
end;
$$;

revoke all on function public.withdraw_comootd_curator_application() from public, anon, authenticated;
grant execute on function public.withdraw_comootd_curator_application() to authenticated;

create or replace function public.admin_review_comootd_curator_application(
  p_application_id uuid,
  p_decision text,
  p_admin_note text,
  p_trust_level text default 'emerging',
  p_active_look_limit integer default 30
)
returns public.curator_applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_decision text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_decision, '')));
  v_note text := nullif(pg_catalog.btrim(coalesce(p_admin_note, '')), '');
  v_trust text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_trust_level, 'emerging')));
  v_application public.curator_applications%rowtype;
begin
  if v_actor_id is null or not (select private.is_sisip_admin()) then
    raise exception 'Hanya admin COMOOTD yang dapat meninjau pengajuan Curator.' using errcode = '42501';
  end if;
  if v_decision not in ('approved', 'rejected') then
    raise exception 'Keputusan pengajuan belum valid.';
  end if;
  if v_trust not in ('emerging', 'verified', 'editorial') then
    raise exception 'Trust level belum valid.';
  end if;
  if p_active_look_limit is null or p_active_look_limit not between 0 and 1000 then
    raise exception 'Limit Look Curator harus antara 0 dan 1000.';
  end if;
  if v_note is not null and char_length(v_note) > 1000 then
    raise exception 'Catatan admin maksimal 1000 karakter.';
  end if;

  select * into v_application
  from public.curator_applications
  where id = p_application_id and status = 'submitted'
  for update;
  if v_application.id is null then
    raise exception 'Pengajuan tidak ditemukan atau sudah ditinjau.';
  end if;

  if v_decision = 'approved' then
    if exists (
      select 1 from public.curator_profiles cp
      where cp.handle = v_application.requested_handle
        and cp.user_id <> v_application.applicant_id
    ) then
      raise exception 'Handle Curator sudah digunakan. Minta pemohon memilih handle lain.';
    end if;

    insert into private.comootd_account_roles (user_id, account_role)
    values (v_application.applicant_id, 'contributor')
    on conflict (user_id) do update
      set account_role = 'contributor', updated_at = now();

    insert into public.curator_profiles (
      user_id, handle, display_name, bio, job_tags, is_active,
      active_look_limit, trust_level
    ) values (
      v_application.applicant_id, v_application.requested_handle,
      v_application.display_name, v_application.bio, v_application.profile_tags,
      true, p_active_look_limit, v_trust
    )
    on conflict (user_id) do update set
      handle = excluded.handle,
      display_name = excluded.display_name,
      bio = excluded.bio,
      job_tags = excluded.job_tags,
      is_active = true,
      active_look_limit = excluded.active_look_limit,
      trust_level = excluded.trust_level,
      updated_at = now();

    insert into public.comootd_notifications (user_id, kind, title, message, action_url)
    values (
      v_application.applicant_id,
      'curator_application',
      'Pengajuan Curator disetujui',
      'Profil Curator kamu sudah aktif. Buka Curator Studio untuk melengkapi profil dan menerbitkan look pertama.',
      '/#curators'
    );
  else
    insert into public.comootd_notifications (user_id, kind, title, message, action_url)
    values (
      v_application.applicant_id,
      'curator_application',
      'Update pengajuan Curator',
      coalesce(v_note, 'Pengajuanmu belum dapat disetujui saat ini. Kamu dapat memperbaiki informasi dan mengirim ulang.'),
      '/#curators'
    );
  end if;

  update public.curator_applications
  set status = v_decision,
      admin_note = v_note,
      reviewed_by = v_actor_id,
      reviewed_at = now()
  where id = p_application_id
  returning * into v_application;

  return v_application;
end;
$$;

revoke all on function public.admin_review_comootd_curator_application(uuid, text, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.admin_review_comootd_curator_application(uuid, text, text, text, integer)
  to authenticated;

create or replace function public.admin_moderate_comootd_curator(
  p_user_id uuid,
  p_is_active boolean,
  p_active_look_limit integer,
  p_trust_level text
)
returns public.curator_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_trust text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_trust_level, '')));
  v_profile public.curator_profiles%rowtype;
begin
  if v_actor_id is null or not (select private.is_sisip_admin()) then
    raise exception 'Hanya admin COMOOTD yang dapat memoderasi Curator.' using errcode = '42501';
  end if;
  if p_active_look_limit is null or p_active_look_limit not between 0 and 1000 then
    raise exception 'Limit Look Curator harus antara 0 dan 1000.';
  end if;
  if v_trust not in ('emerging', 'verified', 'editorial') then
    raise exception 'Trust level belum valid.';
  end if;

  update public.curator_profiles
  set is_active = p_is_active,
      active_look_limit = p_active_look_limit,
      trust_level = v_trust,
      updated_at = now()
  where user_id = p_user_id
  returning * into v_profile;
  if v_profile.user_id is null then
    raise exception 'Profil Curator tidak ditemukan.';
  end if;

  insert into public.comootd_notifications (user_id, kind, title, message, action_url)
  values (
    p_user_id,
    'moderation',
    case when p_is_active then 'Akses Curator aktif' else 'Akses Curator dinonaktifkan' end,
    case when p_is_active
      then 'Akses Curator kamu aktif dengan trust level ' || v_trust || '.'
      else 'Akses Curator kamu dinonaktifkan. Hubungi comootd@gmail.com jika membutuhkan penjelasan.'
    end,
    '/#curators'
  );
  return v_profile;
end;
$$;

revoke all on function public.admin_moderate_comootd_curator(uuid, boolean, integer, text)
  from public, anon, authenticated;
grant execute on function public.admin_moderate_comootd_curator(uuid, boolean, integer, text)
  to authenticated;

create or replace function public.mark_comootd_notification_read(p_notification_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_count integer;
begin
  if v_actor_id is null then
    raise exception 'Masuk terlebih dahulu.' using errcode = '42501';
  end if;
  update public.comootd_notifications
  set read_at = coalesce(read_at, now())
  where user_id = v_actor_id
    and (p_notification_id is null or id = p_notification_id);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.mark_comootd_notification_read(uuid) from public, anon, authenticated;
grant execute on function public.mark_comootd_notification_read(uuid) to authenticated;

-- Self-activation is intentionally closed. Only an approved application can
-- create or reactivate the contributor role from this point forward.
revoke execute on function public.activate_comootd_curator(text, text, text[]) from authenticated;

notify pgrst, 'reload schema';
