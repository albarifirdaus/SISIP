-- Cover the composite collection ownership foreign key used by saves.
create index if not exists comootd_saved_items_collection_owner_idx
  on public.comootd_saved_items (collection_id, user_id);
