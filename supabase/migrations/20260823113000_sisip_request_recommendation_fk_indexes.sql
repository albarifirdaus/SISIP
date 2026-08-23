-- Cover direct foreign-key lookups used when a published catalogue target is checked,
-- deleted, or replaced in a member request response.
create index if not exists outfit_request_recommendations_look_id_idx
  on public.outfit_request_recommendations (look_id);

create index if not exists outfit_request_recommendations_product_id_idx
  on public.outfit_request_recommendations (product_id);

