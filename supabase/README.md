# Supabase setup for SISIP

Target project: `rbvrlfmsvmwjkisbwuim`.

The following migrations have already been applied to that project:

1. `20260821_sisip_initial.sql`
2. `20260821_sisip_hardening.sql`
3. `20260821_sisip_function_permissions.sql`
4. `20260821_sisip_admin_email.sql`
5. `20260821_sisip_bulk_import_and_trigger_fix.sql`
6. `20260822122107_sisip_new_series_slots.sql`
7. `20260822132500_sisip_new_series_atomic_update.sql`
8. `20260822134500_sisip_new_series_lock_candidates.sql`
9. `20260822170000_sisip_journal_studio.sql`
10. `20260822172000_sisip_journal_cta_integrity.sql`
11. `20260823110000_sisip_member_profiles_and_requests.sql`
12. `20260823113000_sisip_request_recommendation_fk_indexes.sql`
13. `20260823143000_sisip_member_preference_tag_limit.sql`
14. `20260823180000_sisip_look_bulk_import.sql`
15. `20260824173506_allow_partial_new_series.sql`

For a fresh Supabase project, apply every file in `migrations/` in name order. The initial migration creates the schema, RLS policies, and public-read `sisip-media` bucket; later migrations enforce Shopee-only URLs and additional catalogue consistency/security rules.

## Finish admin setup

1. In **Authentication → Providers**, keep Email enabled and allow public email sign-ups for SISIP members.
2. In **Authentication → Users**, create the one admin user: `albarifirdaus209@gmail.com`.
3. Set a password privately in the Supabase Dashboard. It must never be committed or sent to this project.
4. In **Authentication → URL Configuration**, add `https://sisip-fashion.pages.dev` as Site URL and `https://sisip-fashion.pages.dev/**` as a Redirect URL; enable email confirmation for the live site.
5. In **Authentication → Emails → SMTP Settings**, configure Custom SMTP with a verified sender name such as `SISIP`. The default Supabase sender on Free is not for delivering confirmation messages to public users.
6. Keep `config.js` using the **Publishable key**. This key is allowed in browser code only because the migration enables Row Level Security.
7. Do not put a database password, `service_role`, or secret key into `config.js`, GitHub, or the hosting dashboard's public variables.

Uploads to `sisip-media` are restricted to the signed-in admin. Every new Auth account receives a profile and private preference row via an Auth trigger.

## Data model

`products` owns a single Shopee affiliate link. `product_variants` stores each colour/image. A `look` uses variants through `look_items`, so one product can appear in many different looks without duplicating its link.

`new_series_slots` stores up to five ordered homepage positions. It is publicly readable only when its associated look is published; the admin updates all five slots atomically through the `set_sisip_new_series` RPC, while empty slots remain hidden from the public carousel.

`user_preferences` stores private profile choices (style, occasion, colour, and budget). Row Level Security lets the owner manage only their own row, while the SISIP admin retains Studio access. The current profile picker allows up to 10 tags per group.

`outfit_requests` is member-only: a database trigger derives `requester_id`, name, and email from the authenticated session. `outfit_request_admin_notes` is admin-only, while `outfit_request_recommendations` is shown to its owner only after the request is replied or closed. Recommendations can point only to published Looks/products.

## Before production

- Point the live hosting URL to Supabase Auth redirect URLs.
- Confirm that email sign-up and email confirmation are configured for the intended audience.
- Enable leaked-password protection in Supabase Auth when available.
- Back up database data and media periodically; the Free plan has no automatic backups.

