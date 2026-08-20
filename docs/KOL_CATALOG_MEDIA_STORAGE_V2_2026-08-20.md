# KÖL Catalog Media Storage V2 — 2026-08-20

This source-only restack updates the recovered catalog-media design against current Supabase Storage guidance and the live KÖL schema.

## Verified live baseline

- 0 Storage buckets.
- 0 Storage objects.
- 0 `storage.objects` policies.
- 0 `public.media_files` rows.
- `media_files` is still the legacy metadata shape (`owner_type`, `owner_id`, `url`, `alt`, `sort_order`, timestamps).
- Current Storage helpers `storage.foldername`, `storage.extension`, `storage.allow_only_operation` and `storage.allow_any_operation` exist in the live project.

## V2 boundary

The SQL draft no longer creates or updates the bucket directly. `catalog-media` is provisioned through Supabase Storage API with:

- private access;
- 8 MiB file-size limit;
- allowed MIME types: JPEG, PNG, WebP, AVIF;
- SVG excluded.

`009_catalog_media_storage_DRAFT_NOT_APPLIED.sql` fails closed if that exact bucket contract is absent or different.

A server-only helper is included:

- `npm run check:catalog-media-bucket` — read-only contract check;
- `npm run provision:catalog-media-bucket` — non-production Storage API create/update followed by verification.

The provisioning helper requires a server-side service-role key and refuses production mutation. The application upload/read flows themselves do not use service-role bypasses.

## Access model

Canonical object path:

`<business_uuid>/<owner_type>/<owner_uuid>/<random-file>`

Supported owners: `menu_item`, `product`, `tour`, `stay`.

Partners manage media only for catalog owners belonging to their active business scope. Anonymous catalog reads are limited to active catalog owners under approved partners and are operation-scoped so anonymous object listing is not granted.

Public rendering uses short-lived signed URLs from the private bucket. Partner uploads use the authenticated user session and Storage RLS. Metadata insert failure triggers best-effort Storage API cleanup.

## Safety

No Storage bucket, Storage object, RLS policy or `media_files` column has been changed in the live Supabase project by this source work. Staging role tests are mandatory before live apply.
