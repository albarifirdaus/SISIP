-- Move the original public auth trigger function outside the Data API and
-- tighten its privileges. Existing triggers retain the function by OID.

do $$
begin
  if to_regprocedure('public.handle_new_user()') is not null then
    execute 'alter function public.handle_new_user() set schema private';
  end if;
end;
$$;
revoke all on function private.handle_new_user() from public, anon, authenticated;

-- Covers the Journal author relationship reported by Supabase's performance
-- advisor. Other unused-index notices are expected while the database is empty.
create index if not exists articles_author_id_idx on public.articles (author_id);

