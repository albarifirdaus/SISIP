-- Published Looks are publicly shareable. The existing RLS policy keeps
-- this limited to their inline items; this grant merely lets the anon role
-- reach the table through the Data API.
grant select on table public.look_curation_items to anon;
