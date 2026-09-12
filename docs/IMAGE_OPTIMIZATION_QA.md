# New-upload image optimization — 12 September 2026

## Behavior

- Existing uploaded files and external image URLs are untouched.
- Central browser-side optimizer covers product images, Look cover/gallery, curator avatars, journal cover/block images, storefront designs and campaign banners.
- Photo maximum long edge: 1600 px; avatar: 400 px; banner/storefront: 1920 px. Existing crop aspect rules remain, but small sources are no longer enlarged.
- WebP quality starts at 0.90 and may use 0.85 when over the soft byte target. All encodes come from the same source canvas. Size targets are not hard quality-reduction loops.
- PNG inputs and transparent images use PNG to preserve graphics/alpha losslessly. They can remain larger than photo targets. Already smaller originals are retained when dimensions permit.
- Cropper shares prepared results with upload; draft-restored prepared files within size bounds retain their main bytes. Thumbnails are generated separately, not by repeatedly recompressing the main image.
- Thumbnail long edge is at most 640 px. Filename markers encode real pixel widths for `srcset`; no database schema changes are needed. Detail views retain the full image. Legacy filenames never get invented thumbnail URLs.
- Raw single-image fields show optional before/after previews; crop fields show their existing prepared preview plus real output dimensions and size change.
- Current upload limits remain: 5 MB general, 2 MB for storefront designs. Unsupported, corrupt and animated inputs fail clearly rather than silently flattening animation.
- Storage keeps existing owner/admin authorization. Upload paths remain inside existing authorized folders, use unique names and never overwrite. Both variants must upload successfully before the main path is returned. Replacement/failed-save cleanup expands only the exact owned variant paths.

## Verification

- `node tools/qa-image-optimizer.mjs`: real browser Canvas encoding, no upscale, PNG alpha, dimensions, cache reuse, responsive widths, malformed input, two-part upload and partial-failure cleanup (mock storage), raw preview and mobile cropper integration.
- `node tools/qa-image-optimizer.mjs --sample assets/generated/storefront-looks-v1.png`: optional local fashion asset check. Sample converted to JPEG for photo-codec comparison: 352407 bytes source, 127048 bytes detail, 29720 bytes thumbnail, 1254 square pixels. Visual comparison checked; not a universal compression guarantee. The optional sample is not committed or uploaded.
- `node tools/release-check.mjs`: existing static/wizard/draft checks passed.
- `node tools/qa-pagination.mjs`: public catalogue regression on six widths passed.
- Read-only hosted Storage checks: `sisip-media` public bucket accepts JPEG, PNG and WebP, 5242880-byte limit; current curator/admin policies accept the unchanged directory structure. No policy, bucket, database row or existing media was changed.
- Signed-in end-to-end production uploads were not performed; codec/crop behavior and Storage call sequencing were tested locally, with hosted policy/config inspection. Production media insertion is left to normal user uploads.

## Limits

Browser-side compression is an upload UX/performance feature, not a server-enforced quota or trusted image moderation boundary. A custom API client can bypass it; existing server MIME, size and RLS checks remain authoritative. Old media would require a separate migration/optimization task. Lossy output is not pixel-identical; PNG is retained for lossless graphics, with soft targets rather than forced degradation.
