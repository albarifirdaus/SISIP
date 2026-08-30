-- Keep the original COMOOTD vocabulary available in the shared taxonomy.
-- Admin can rename, reorder, hide, or deactivate any of these later.
insert into public.comootd_style_tags (name, is_active, is_explore_visible, sort_order)
values
  ('Clean', true, true, 10),
  ('Casual', true, true, 20),
  ('Formal', true, true, 30),
  ('Streetwear', true, true, 40),
  ('Modest', true, true, 50),
  ('Sporty', true, false, 60),
  ('Vintage', true, false, 70),
  ('Korean-inspired', true, false, 80),
  ('Workwear', true, false, 90),
  ('Party', true, false, 100)
on conflict (normalized_name) do update
set sort_order = excluded.sort_order
where public.comootd_style_tags.sort_order = 0;

