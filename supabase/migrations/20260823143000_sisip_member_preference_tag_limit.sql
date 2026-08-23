-- Keep the database rule aligned with the member profile tag picker.
-- Existing rows were checked before lowering this limit.

alter table public.user_preferences
  drop constraint if exists user_preferences_tag_counts_check;

alter table public.user_preferences
  add constraint user_preferences_tag_counts_check check (
    cardinality(style_tags) <= 10
    and cardinality(occasion_tags) <= 10
    and cardinality(preferred_colors) <= 10
    and cardinality(avoided_colors) <= 10
  );

