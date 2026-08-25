-- `storage.foldername()` returns directory segments only; the file name is
-- returned separately by `storage.filename()`. The original policies treated
-- the file name as another folder, which rejected every Curator avatar and
-- Look-cover upload with an RLS error.

create or replace function private.is_own_comootd_curator_avatar_path(p_path text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_path is null
    or exists (
      select 1
      from (
        select
          storage.foldername(p_path) as parts,
          storage.filename(p_path) as filename
      ) as path
      where (select auth.uid()) is not null
        and path.parts[1] = 'curators'
        and path.parts[2] = (select auth.uid())::text
        and path.parts[3] = 'avatar'
        and coalesce(array_length(path.parts, 1), 0) = 3
        and nullif(path.filename, '') is not null
    );
$$;

create or replace function private.is_own_comootd_curator_media_path(p_path text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select private.is_active_comootd_curator())
    and exists (
      select 1
      from (
        select
          storage.foldername(p_path) as parts,
          storage.filename(p_path) as filename
      ) as path
      where path.parts[1] = 'curators'
        and path.parts[2] = (select auth.uid())::text
        and (
          (
            path.parts[3] = 'avatar'
            and coalesce(array_length(path.parts, 1), 0) = 3
            and nullif(path.filename, '') is not null
          )
          or
          (
            path.parts[3] = 'looks'
            and path.parts[4] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            and coalesce(array_length(path.parts, 1), 0) = 4
            and nullif(path.filename, '') is not null
          )
        )
    ),
    false
  );
$$;

revoke all on function private.is_own_comootd_curator_avatar_path(text)
  from public, anon, authenticated;
revoke all on function private.is_own_comootd_curator_media_path(text)
  from public, anon, authenticated;
grant execute on function private.is_own_comootd_curator_avatar_path(text)
  to authenticated;
grant execute on function private.is_own_comootd_curator_media_path(text)
  to authenticated;
