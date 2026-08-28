-- Curator body metrics are optional, but automatically public when provided.
-- The Curator Studio no longer exposes a separate visibility decision.

alter table public.curator_body_metrics
  alter column is_public set default true;

update public.curator_body_metrics
set is_public = true
where is_public is distinct from true;

drop policy if exists "Public reads opted-in Curator body metrics"
  on public.curator_body_metrics;

drop policy if exists "Public reads active Curator body metrics"
  on public.curator_body_metrics;

create policy "Public reads active Curator body metrics"
  on public.curator_body_metrics for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.curator_profiles as cp
      where cp.user_id = curator_body_metrics.user_id
        and cp.is_active
    )
  );
