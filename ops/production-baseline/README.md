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
