-- Change SISIP's single admin identity.
-- The password and Auth-user creation stay in Supabase Auth, never in SQL or frontend code.

create or replace function private.is_sisip_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users as u
    where u.id = auth.uid()
      and pg_catalog.lower(u.email) = 'albarifirdaus209@gmail.com'
  );
$$;

revoke all on function private.is_sisip_admin() from public;
grant execute on function private.is_sisip_admin() to authenticated;

insert into public.profiles (id, display_name)
select u.id, coalesce(u.raw_user_meta_data ->> 'display_name', 'SISIP Admin')
from auth.users as u
where pg_catalog.lower(u.email) = 'albarifirdaus209@gmail.com'
on conflict (id) do nothing;

