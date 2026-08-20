# KÖL — Live Supabase Schema Fingerprint

**Captured:** 2026-08-20  
**Project:** `kol-travel-platform-test`  
**Project ref:** `mphruawzozrpwcjgejhs`  
**Purpose:** compact drift-detection baseline before any new migration work.

## Structural counts

- public base tables: **54**
- public RLS-enabled tables: **54**
- public RLS policies: **46**
- public helper/trigger functions: **6**
- public indexes: **99**

## Fingerprints

These hashes are generated from the current live database metadata with deterministic ordering.

| Surface | MD5 fingerprint |
|---|---|
| public columns | `cd623ef2b347cde915bca33a42f73894` |
| public RLS policies | `64a042b02b039bd9cac451c571d3de52` |
| public functions | `08f2c73926db9d6e2eea8d11218c8a42` |
| public indexes | `a23e64b3dc1e70662353fc6378a9be3c` |

## Interpretation

If any hash changes before the recovery baseline is formally accepted, the live database has drifted and the planned migration must be re-audited against the new state.

These fingerprints are not a substitute for a logical backup or schema dump. They are an additional guardrail that makes unexpected drift visible quickly.

## Current migration state

`supabase_migrations.schema_migrations` is absent in the live project. Therefore these hashes describe the authoritative live schema, not a migration-ledger state.

## Safety

This fingerprint capture was read-only. No schema, data, Auth, Storage, Edge Function, deployment, or environment value was changed.
