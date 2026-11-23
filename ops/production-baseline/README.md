# KÖL production baseline — 22 November 2026

This is a **schema-only** snapshot from the separate active KÖL TEST Supabase
project (`mphruawzozrpwcjgejhs`), not a migration performed on production.
It is kept as the starting point for a NEW, empty Supabase production project.

- Source: GitHub Actions **44988659260** (`schema_export`, explicitly read-only).
- Source revision: `269c900330a1b3efbe394c8e777a88c527c6b903`.
- File: `kol-schema-20261122.sql` (496,422 bytes, 13,217 lines).
- SHA-256: `d5740eef4fa6bc8f76602900d22e6f856827ec308459c82a0175fc1ce87a6d7d`.
- Contains: application DDL (including 71 CREATE TABLE and 103 CREATE POLICY
  statements). **Contains no Auth users, payments, bookings, orders, or data inserts.**
- Source had 35 managed migrations; historical bodies have not all been
  recovered. This snapshot is a **new canonical schema baseline**, never a
  fabricated reconstruction of the 35 past SQL migrations.
- The live KÖL TEST database, Vercel settings, and all production data were
  **not changed** by generating this file.

## Production bootstrap — deliberate manual operation only

1. Create a NEW separate Supabase project and keep its env/keys separate from
   existing QA and Vercel Preview.
2. Compare built-in auth/storage schemas, extensions and reserved roles with
   this snapshot before applying any app DDL to the new empty project.
3. Apply only to the new production project, in controlled order; do not replay
   the 35 historical migrations or the old 44-step bundle over this snapshot.
4. The snapshot contains schema only. Supabase Storage buckets, initial
   operational settings, and confirmed commercial data require separate
   deliberate creation. Never import QA users, test availability, or payments.
5. Confirm role grants and RLS before allowing customers to authenticate.
   Do not remove the production-runtime guard until real provider integration,
   data segregation, and commercial terms are configured.

**Not a go-live approval. Never execute directly against KÖL TEST or a
database containing business records.**


## November 22 extension — current QA 72/37, production remains empty

Read-only Supabase inspection on 2026-11-22 found **72 public tables, 37
managed migrations, five QA Auth users, zero Storage objects** in TEST.
The separately provisioned production project (`sggajelagfonzpovnsiz`)
has **0 public tables, 0 Auth users, 0 Storage buckets and 0 objects** on
PostgreSQL 17.12. The older baseline above represents the **35-migration
snapshot**, not the two subsequent managed QA migrations.

Before any production bootstrap:
- Review the standalone read-only `kol-production-preflight.sql` against
  the *explicitly selected* production project. Do not copy QA secrets.
- Verify the 35-migration schema-only baseline SHA-256 pinned above. That
  snapshot is **not** a replayable reconstruction of the unknown historical
  migration bodies (eight still unresolved).
- Install the snapshot only on a verified **empty disposable Supabase target**
  first. Apply any approved delta in this order:
  `20261122071537_content_policy_prerequisite.sql`,
  `20261122071538_kol_ai_admin_knowledge_hub_v1.sql`,
  `20261122073611_sync_auth_email_for_account_security.sql`,
  `20261122091114_kol_ai_updated_by_fk_indexes.sql`.
  Historical applied version numbers in TEST differ from these source
  filenames; do not rewrite either environment's ledger to disguise it.
- On the disposable clone, run `kol-production-postflight.sql` and
  compare grants, functions, triggers, RLS, constraints and storage with
  TEST. Passing source-code CI alone is not enough.
- Repeat the same reviewed source on empty production **only after**
  disposable proof and separate approval of the exact target and commit.
  Never run `supabase db reset`, blind `db push`, historical 44-step
  APPLY, demo seeds or a full QA data restore on Production.
- Keep Vercel Preview bound to TEST and Production bound to the dedicated
  production Supabase. The currently shared `NEXT_PUBLIC_SUPABASE_*`
  Vercel variables must be isolated before production deployment.
- Production credentials, real payment provider integration, verified
  SMTP and genuine commercial date/price data are release gates. Do not
  activate `PRODUCTION_RUNTIME_IMPLEMENTATION_READY` or switch DNS on
  the strength of an empty schema alone.

**Status:** preparation only. No SQL from this directory has been
executed on Production as part of this release note.


## Verified empty Production schema installed — 22 November 2026 (latest)
On `kol-travel-platform-production` (`sggajelagfonzpovnsiz`), a clean
canonical 69-table baseline plus four reviewed deltas was applied after a
disposable clean-room PASS. **No QA data or users were transferred.**
A separate audit discovered that pg_dump did not preserve all historical
`GRANT/REVOKE` protections. Two additional immutable migrations were applied:
`kol_production_acl_parity_20261122` and
`kol_production_column_acl_parity_20261122`.
Production now has **72 public tables and seven managed release migrations**.
QA reference permissions match: **75 relations, 53 public RPCs,
one sequence and 49 column-specific grants**. Supabase Security Advisor now
reports the same two intentional anon `SECURITY DEFINER` inventory functions
as QA, not the initial 18.

The clean-room script must apply BOTH privilege overlays after the four deltas
and before its postflight SQL check. Production remains **NO-GO** for public
traffic: no Production Auth users/invitations, SMTP evidence, verified commerce
availability or payment-provider settlement; production Vercel keys and
`kol.on.kg` remain unpromoted. Never restore QA data into Production.


### Storage parity completed (latest, 22 November 2026)
`kol_production_catalog_media_storage_20261122` was applied after
ACL alignment. The isolated Production Supabase now has **eight managed
release migrations**, 72 public application tables, zero Auth users,
a single empty private `catalog-media` bucket (8 MiB, JPEG/PNG/WebP/AVIF)
and five approved Storage RLS policies identical to QA. No files were
copied or published. The clean-room source includes this configuration
after the ACL overlays; its postflight checks bucket metadata and all
five policy names. The public site remains on the previous host.
