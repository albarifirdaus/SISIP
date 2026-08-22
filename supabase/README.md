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

For a fresh Supabase project, apply every file in `migrations/` in name order. The initial migration creates the schema, RLS policies, and public-read `sisip-media` bucket; later migrations enforce Shopee-only URLs and additional catalogue consistency/security rules.

## Finish admin setup

1. In **Authentication → Providers**, keep Email enabled and turn off public sign-ups.
2. In **Authentication → Users**, create the one admin user: `albarifirdaus209@gmail.com`.
3. Set a password privately in the Supabase Dashboard. It must never be committed or sent to this project.
4. In **Authentication → URL Configuration**, add the final hosting URL to Site URL and Redirect URLs.
5. Keep `config.js` using the **Publishable key**. This key is allowed in browser code only because the migration enables Row Level Security.
6. Do not put a database password, `service_role`, or secret key into `config.js`, GitHub, or the hosting dashboard's public variables.

Uploads to `sisip-media` are restricted to the signed-in admin. The user profile is created by an Auth trigger after the admin account is made.

## Data model

`products` owns a single Shopee affiliate link. `product_variants` stores each colour/image. A `look` uses variants through `look_items`, so one product can appear in many different looks without duplicating its link.

`new_series_slots` stores exactly five ordered homepage positions. It is publicly readable only when its associated look is published; the admin replaces all five positions through the `set_sisip_new_series` RPC so a reorder is atomic and cannot produce duplicate slots.

## Before production

- Move the public outfit-request form behind an Edge Function plus CAPTCHA/rate-limit protection.
- Point the live hosting URL to Supabase Auth redirect URLs.
- Back up database data and media periodically; the Free plan has no automatic backups.

