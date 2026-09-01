alter table public.curator_profiles
  add column if not exists follower_count integer not null default 0
  check (follower_count >= 0);

update public.curator_profiles as cp
set follower_count = counts.total
from (
  select curator_id, count(*)::integer as total
  from public.comootd_curator_follows
  group by curator_id
) as counts
where counts.curator_id = cp.user_id;

update public.curator_profiles as cp
set follower_count = 0
where not exists (
  select 1
  from public.comootd_curator_follows as follows
  where follows.curator_id = cp.user_id
);

create or replace function private.sync_comootd_curator_follower_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.curator_profiles
    set follower_count = follower_count + 1
    where user_id = new.curator_id;
    return new;
  end if;

  update public.curator_profiles
  set follower_count = greatest(follower_count - 1, 0)
  where user_id = old.curator_id;
  return old;
end;
$$;

revoke all on function private.sync_comootd_curator_follower_count() from public, anon, authenticated;

drop trigger if exists comootd_curator_follows_sync_count on public.comootd_curator_follows;
create trigger comootd_curator_follows_sync_count
  after insert or delete on public.comootd_curator_follows
  for each row execute procedure private.sync_comootd_curator_follower_count();
