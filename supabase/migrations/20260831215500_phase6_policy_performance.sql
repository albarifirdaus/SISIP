-- Keep the Phase 6 read path to one permissive policy and index both FKs.

create index if not exists curator_applications_reviewer_idx
  on public.curator_applications (reviewed_by)
  where reviewed_by is not null;

drop policy if exists "Members read own curator application" on public.curator_applications;
drop policy if exists "Admins read curator applications" on public.curator_applications;

create policy "Members and admins read permitted curator applications"
  on public.curator_applications for select
  to authenticated
  using (
    (select auth.uid()) = applicant_id
    or (select private.is_sisip_admin())
  );
