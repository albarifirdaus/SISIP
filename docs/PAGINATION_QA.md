# Catalogue pagination — 11 September 2026

## Scope

- Public Looks and Products: 24 entries per page; Curators: 12.
- Journal and a curator's published Looks: 24 per page, to preserve access after bounded bootstrap loading.
- Server-side search/filter/sort and exact counts; stable ordering and out-of-range page clamping.
- Previous/Next, numbered URL links, page/filter query parameters, retained catalogue scroll after detail return.
- Lazy images, loading/error/retry states and stale-response protection.
- Direct content URLs and saved references hydrate missing entities on demand.
- Admin loading remains unchanged. Curator Studio loads its library and own published Looks only when opened, not for anonymous catalogue browsing.

## Checks

- `node tools/release-check.mjs`: syntax, application tests, draft/wizard regression, worker metadata, Git whitespace.
- `node tools/qa-pagination.mjs`: synthetic 80 Looks, 80 Products, 40 Curators; 360/390/430/768/1024/1440 px; page sizes, Next, cross-page search, range clamp, return scroll, stale responses, errors/recovery, profile and Look direct reload.
- `node tools/qa-pagination.mjs --live`: local candidate frontend with read-only real backend queries; all non-read REST operations blocked. Same six widths and detail/profile reloads.
- Worker tests cover canonical `?page=2` and page-specific titles for Looks, Products, Curators, curator profiles, Journal and styles.
- Backend anonymous-role SQL checks confirmed published/active records only, fixed page sizes, counts and clamping. Current small catalogue: 5 Looks, 13 Products, 3 Curators, 1 Journal article. Synthetic data was never uploaded.

## Database and release

- Additive invoker-security functions in migration `20260911065006_public_catalogue_pagination.sql`, matching hosted migration history. No catalogue rows modified or deleted; existing RLS applies.
- New functions were not flagged by the security advisor. Existing analytics/legacy definer-function and password-protection findings remain outside this release.
- Rollback target before release: healthy Cloudflare deployment `3ea471df-a929-4dba-8118-9f7d7e72f5df`, commit `6a21560f6c49f268f1c681bd3e94eebda3da6b23`. Reverting frontend does not require dropping these additive functions.
- This is functional pagination QA, not a capacity/load-test result. Database counting/search cost still grows with catalogue size; measure query plans and response times as real content grows.
- Signed-in Studio and saved-collection interactions were not manually exercised with a real account in this release; existing draft/wizard regression checks and scoped hydration review were used. No private account data was changed.
