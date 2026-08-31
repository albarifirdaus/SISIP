-- Cover the analytics user foreign key for account deletion and maintenance.
create index if not exists comootd_analytics_user_created_idx
  on public.comootd_analytics_events (user_id, created_at desc);
