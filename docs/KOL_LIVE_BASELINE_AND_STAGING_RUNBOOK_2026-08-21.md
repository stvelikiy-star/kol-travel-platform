# KÖL — Live Baseline and Staging Rehearsal Runbook

**Date:** 2026-08-21  
**Scope:** backup/baseline preparation and controlled migration rehearsal  
**Execution status:** DOCUMENTATION ONLY — NO LIVE COMMAND HAS BEEN RUN BY THIS FILE

---

## 0. Purpose

This runbook defines the evidence required before any KÖL draft SQL is applied to the live Supabase project.

It exists because the recovered live database has no trustworthy `supabase_migrations.schema_migrations` ledger. The current 21-layer draft stack has passed in disposable local Supabase, but that is not a substitute for an authoritative live backup/baseline.

This runbook must fail closed: if backup scope, credentials, target isolation or rollback semantics are uncertain, do not apply migrations.

---

## 1. Hard execution gates

Do **not** execute a live migration unless all are true:

- explicit owner approval for the live/staging action exists;
- an authoritative logical DB backup has been captured and validated;
- backup artifacts are stored outside the database being changed;
- backup checksum(s) are recorded;
- current schema/catalog fingerprints and row-count baseline are recorded;
- the exact migration files/hashes/order are frozen;
- an isolated staging/rehearsal target is approved;
- rollback/recovery decision tree is accepted;
- production payment/provider state is understood;
- Storage bytes are treated separately from DB metadata;
- no secret is committed to Git or printed into CI logs.

If a Supabase development branch or another paid resource is used, explicit cost confirmation is also required before creation.

---

## 2. Current live identity — verify again immediately before backup

Expected project identity from the last read-only audit:

- Supabase project: `kol-travel-platform-test`
- ref: `mphruawzozrpwcjgejhs`
- region: `ap-northeast-2`
- PostgreSQL: `17.6.1.127`
- expected health: `ACTIVE_HEALTHY`

Expected last-audited public baseline:

- 54 public base tables
- 54/54 RLS enabled
- 46 public policies
- 26 RLS-enabled tables with zero policies
- 6 public helper/trigger functions
- 99 public indexes
- 4 recovery/demo Auth users
- 0 payment rows
- 0 Storage buckets
- 0 Storage objects
- no `supabase_migrations.schema_migrations` table/ledger

These values are guardrails, not assumptions. Re-read them before any backup or migration. Unexpected drift is a stop condition until explained.

---

## 3. Required backup artifact set

The minimum accepted baseline package should contain:

1. **logical database dump** suitable for inspection/restore testing;
2. **schema-only dump** for human diff/review;
3. **catalog/baseline report** with table, policy, function, index and FK facts;
4. **critical row-count report** for transactional tables;
5. **migration package manifest** with SHA-256 hashes;
6. **artifact checksums** for all backup files;
7. **restore/rehearsal log** proving the backup can actually be read/restored to the approved isolated target;
8. **Storage inventory + separate object-byte backup plan**, if/when Storage contains objects;
9. **external-payment reconciliation snapshot**, once a real provider has ever processed settlements.

A schema fingerprint alone is not a backup.

---

## 4. Secret handling contract

Database credentials must enter only through a protected environment/secret store or an interactive protected shell.

Never:

- put passwords/tokens in this Markdown file;
- commit a `.env` containing secrets;
- echo a DB URL containing a password;
- write secrets to GitHub Actions output;
- paste a service-role key into command history if an alternative protected secret mechanism is available.

Use symbolic placeholders in documentation, for example:

```text
KOL_DB_HOST
KOL_DB_PORT
KOL_DB_NAME
KOL_DB_USER
KOL_DB_PASSWORD   # secret store only
```

---

## 5. Pre-backup read-only capture

Before the dump, capture a timestamped baseline report. At minimum record:

### Database/server identity

- PostgreSQL version;
- database name;
- server/region/project ref;
- current UTC timestamp;
- transaction read-only/read-write state used for inspection.

### Public schema inventory

Record:

- base tables;
- RLS enabled flags;
- policy count and definitions;
- functions and `proconfig` / search path state;
- indexes and validity/readiness;
- constraints and FKs;
- grants for `anon`, `authenticated`, `service_role` and relevant owners.

### Transactional row counts

Record at least counts for:

- `bookings`
- `booking_status_history`
- `orders`
- `order_items`
- `order_status_history`
- `payments`
- `order_payments`
- `transactions`
- `delivery_status_history`
- `courier_assignments`
- `media_files`

If a table does not exist in the live recovered baseline, record that fact rather than inventing zero.

### Auth / Storage metadata

Record only non-secret metadata needed for reconciliation, such as:

- Auth user count;
- Storage bucket names/privacy flags;
- Storage object counts by bucket.

Do not export or publish credentials/secrets.

---

## 6. Logical backup procedure — approved execution environment only

Use a PostgreSQL client version compatible with the server. A standard custom-format logical dump is preferred for restore rehearsal because it supports `pg_restore --list` and selective inspection.

Illustrative protected-shell pattern:

```bash
set -Eeuo pipefail
umask 077

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="kol-live-baseline-${STAMP}"
mkdir -p "$OUT"

# Credentials must be supplied securely outside Git.
# Do not echo the connection string or password.

pg_dump \
  --format=custom \
  --no-owner \
  --file "$OUT/database.custom.dump" \
  "$KOL_DATABASE_URL"

pg_dump \
  --schema-only \
  --no-owner \
  --file "$OUT/schema.sql" \
  "$KOL_DATABASE_URL"

pg_restore --list "$OUT/database.custom.dump" > "$OUT/database.restore-list.txt"
sha256sum "$OUT"/* > "$OUT/SHA256SUMS"
```

The exact connection mechanism must be reviewed for the current Supabase project before execution. Never guess a password or endpoint.

If the provider/dashboard offers an authoritative backup/export mechanism, preserve its artifact/reference too; do not treat an unverified dashboard label as proof that a usable logical restore artifact exists.

---

## 7. Backup validation — mandatory before migration

A dump command returning exit code 0 is not enough.

Validate:

- dump file exists and is non-empty;
- schema dump exists and is non-empty;
- `pg_restore --list` succeeds for custom dump;
- SHA-256 checksum file is generated;
- artifacts are copied to a storage location independent of the target DB;
- a second checksum after copy matches;
- restore to an approved isolated target succeeds;
- restored schema inventory is compared with the pre-backup baseline;
- critical row counts match or differences are explained by capture timing;
- required extensions/types/functions used by KÖL are present or compatibility differences are explicitly documented.

Only after restore rehearsal succeeds should the backup be called **RESTORE-TESTED**.

---

## 8. Staging/rehearsal target options

Preferred order of safety:

### Option A — disposable local Supabase

Already useful for migration syntax, RLS, RPC and transaction behavior. Current 21-layer local suite is green.

Limitation: it does not prove the recovered live dataset can be migrated safely.

### Option B — isolated restore target built from the new live logical backup

Use an isolated PostgreSQL/Supabase-compatible environment approved for the rehearsal.

Goal:

- restore actual recovered live shape/data snapshot;
- apply the frozen draft sequence;
- run VERIFY + RBAC/E2E/concurrency checks against that restored shape.

### Option C — Supabase development branch

Use only if the product/project supports the required workflow and the owner explicitly accepts the cost.

Never create a cost-bearing branch merely to make a test easier.

---

## 9. Frozen migration package

The currently locally exercised sequence is:

```text
005
005a
006
006a
006b
006c
010
007
007a
007b
008
008a
009
009a
011
011a
011b
011c
012
012a
012b
```

Before rehearsal:

- record exact Git commit containing the files;
- record SHA-256 for every APPLY/VERIFY file;
- record package order;
- prohibit editing files mid-run;
- if any file changes, invalidate the previous rehearsal and restart from a clean restored target.

All current apply files are `DRAFT_NOT_APPLIED` until an explicit controlled apply occurs.

---

## 10. Rehearsal execution contract

For each layer:

1. confirm target identity is **not production**;
2. capture current migration checkpoint;
3. apply exactly one frozen migration layer;
4. execute its read-only VERIFY/invariant checks;
5. run relevant RBAC/transaction checks;
6. record PASS/FAIL with timestamps and commit/file hashes;
7. stop on first unexplained failure;
8. do not continue merely to see how many later migrations work.

A failure must be repaired in source, then the rehearsal restarts from a clean restored baseline unless the failure has an explicitly reviewed safe continuation procedure.

---

## 11. Required post-rehearsal invariants

At minimum prove on the restored live-shape target:

### Security/RBAC

- every expected public table has RLS enabled;
- intended policy coverage exists;
- recursion paths are removed;
- helper search paths are fixed;
- anon/authenticated/service-role grants match intended contracts;
- cross-partner data isolation passes;
- clients cannot mutate trusted audit/payment/delivery truth directly.

### Database integrity

- expected FK/index checks pass;
- no invalid/not-ready target indexes remain in the checked contour;
- migration sequence does not silently delete recovered business data;
- expected row counts/data samples reconcile.

### Transactions

Re-run at least:

- Stay last-room race;
- Tour capacity replay/mismatch;
- Shop last-item race;
- payment exact replay/conflicting replay/amount mismatch/refund-off;
- delivery role/state-machine/idempotency cases.

### Storage

If catalog media is activated:

- bucket remains private;
- cross-partner writes are denied;
- allowed signed-read flow works;
- DB metadata and object-byte recovery strategy are separate and documented.

---

## 12. Rollback and recovery decision tree

### Before real payment activation

If a migration rehearsal or early live migration fails:

- stop writes if needed;
- collect failure evidence;
- do not improvise destructive reverse SQL;
- prefer forward repair or restore only according to the accepted recovery plan;
- verify recovered row counts and invariants after recovery.

### After real payment settlements exist

**Never blind-restore the database over financial truth.**

A DB backup may predate provider settlements. Restoring it can lose or duplicate payment state.

Required recovery path after payment activation:

1. freeze/limit affected writes;
2. preserve current database/payment-event evidence;
3. reconcile provider ledger/webhooks/references;
4. determine DB repair versus restore with financial reconciliation;
5. reapply idempotent provider events only through the trusted payment path;
6. audit every manual correction.

### Storage recovery

A PostgreSQL restore does not restore Storage object bytes. Recover Storage separately and reconcile object metadata to bytes.

---

## 13. Live apply gate

A real live apply request should contain a compact approval packet:

- target project/ref;
- current live head/baseline timestamp;
- backup artifact identifiers and checksums;
- restore-test result;
- frozen Git commit and migration hashes/order;
- staging/rehearsal PASS evidence;
- known residual risks;
- rollback/recovery procedure;
- payment-provider activation state;
- explicit owner approval.

If any element is missing, the default answer is **DO NOT APPLY LIVE**.

---

## 14. Current KÖL status relative to this runbook

Already proven:

- disposable local Supabase 21-layer migration execution;
- local structural invariants;
- Stay/Tour/Shop transaction behavior and concurrency under tested fixtures;
- provider-neutral payment replay/mismatch/refund-off behavior;
- delivery state machine/role behavior;
- source build/lint/TypeScript gates on current proof branches.

Still missing before live SQL:

- real logical backup of the recovered live DB;
- accepted migration baseline/rollback procedure;
- restore test of that backup;
- rehearsal against a target carrying the recovered live shape/data;
- owner authorization for the relevant staging/live action.

---

## 15. No-go summary

This runbook does not authorize:

- live SQL;
- live Auth/Storage mutation;
- production deploy;
- payment activation;
- alcohol activation;
- a paid Supabase branch;
- secret exposure;
- destructive repair;
- silent PR merge.

Its purpose is to make the first future authorized migration evidence-driven and reversible rather than improvised.
