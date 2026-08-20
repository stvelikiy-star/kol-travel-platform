# KÖL — Catalog Media Storage

**Prepared:** 2026-08-20  
**State:** source-only draft; not applied to live Supabase

## Verified live baseline

- Storage buckets: 0
- Storage object policies: 0
- `media_files` rows: 0
- `media_files` currently has no storage path, MIME, size or uploader fields
- Stage 21 `image_url` columns are still unapplied

## Chosen contract

- Private bucket `catalog-media`
- JPEG / PNG / WebP / AVIF only
- 8 MiB max object size
- no SVG
- path: `<business>/<owner_type>/<owner_id>/<random-file>`
- supported catalog owners: menu item, product, tour, stay
- public reads use short-lived signed URLs after anon RLS proves the media belongs to an active catalog object of an approved business
- partners manage only media paths resolving to their own active business membership
- same-business staff can manage shared business media; access is not tied only to the original uploader

## Source flow

Partner upload:

1. authenticated partner role/ownership check;
2. file MIME/size validation;
3. catalog owner must belong to partner business;
4. upload through user's Supabase session/RLS;
5. insert `media_files` metadata;
6. if metadata insert fails, immediately remove uploaded object as compensation.

Public read:

1. anon RLS reads only public media metadata;
2. request a 15-minute signed URL from the private bucket;
3. no service-role key and no permanent public object URL.

## Required staging proof

Run `009_catalog_media_storage_VERIFY.sql` plus role tests for anon, Partner A, Partner B and admin. Confirm no bucket listing to anon, no cross-partner upload/delete, no inactive-item signed URL, MIME/size rejection and compensation cleanup.
