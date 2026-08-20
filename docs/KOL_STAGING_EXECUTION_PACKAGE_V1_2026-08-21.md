# KÖL — Staging Execution Package V1

**Prepared:** 2026-08-21  
**Milestone:** `KOL_STAGING_PROOF_001`  
**Scope:** KÖL / `kol-travel-platform` only  
**State:** source-only; no staging DB created and no SQL applied by this package

## Goal

Remove manual ambiguity from the first real staging proof. The package defines one machine-checked order for the already reviewed V2 database drafts and binds each layer to read-only verification.

## Hard boundary

This package does **not** authorize or perform:

- production SQL apply;
- any apply to the current live recovery/demo Supabase project;
- Stage 21 / `004_minimal_additive_catalog_fields_DRAFT_NOT_APPLIED.sql`;
- `combined_manual_setup.sql`;
- payment-provider activation;
- refunds;
- alcohol enablement;
- production deploy.

## Preconditions before first apply

1. Dedicated staging target exists.
2. Real backup/baseline gate is accepted before any production mutation.
3. `supabase/staging/000_preflight_read_only.sql` matches the expected recovered schema shape or any difference is explicitly reviewed.
4. Target does not contain production traffic or settlement truth.
5. Current exact source commit is recorded.
6. `npm run check:staging-package` passes on that exact commit.

## Canonical apply order

1. `005` — security helper/RLS recursion hardening
2. `005a` — partner policy scope
3. `006` — missing RLS policy completion
4. `006a` — audit write lockdown
5. `006b` — RLS init-plan/scope hardening
6. `006c` — booking/order direct entrypoint lockdown
7. `010` — additive FK leading indexes
8. `007` — Stay/Tour atomic booking core
9. `007a` — booking direct-write lockdown
10. `007b` — booking idempotency serialization
11. `008` — Food/Shop atomic order core
12. `008a` — order idempotency payload hardening
13. `009` — private catalog media metadata/RLS
14. `011` — provider-neutral payment integrity
15. `011a` — payment replay conflict guard
16. `011b` — payment projection/identity hardening
17. `012` — delivery lifecycle core
18. `012a` — recovered delivery assignment consistency
19. `012b` — courier role/assignment consistency hardening

The machine-readable source of truth is `supabase/staging/migration-plan.json`.

## Storage special step

Before applying `009`, create/verify the `catalog-media` bucket through the Supabase Storage API using the server-only provisioning script:

`npm run provision:catalog-media-bucket`

Expected bucket contract:

- private;
- max object size 8 MiB;
- JPEG / PNG / WebP / AVIF only;
- no SVG.

Do not write directly to `storage.buckets` with SQL.

## Execution discipline

For each migration:

1. record the SHA-256 shown by `npm run check:staging-package`;
2. apply exactly one reviewed migration to staging;
3. run its listed VERIFY query immediately;
4. run the relevant functional/role/concurrency check;
5. stop on any mismatch;
6. only then proceed to the next migration.

No batch-pasting the whole stack into one SQL editor run.

## Mandatory functional proof

### RLS / RBAC

- client can access only own private records;
- partner A cannot read/write partner B private records;
- courier can access only assigned delivery contour;
- admin/dispatcher/finance scope matches intended role;
- anon cannot reach private/admin/financial truth;
- no RLS recursion.

### Stay/Tour

- two concurrent attempts for last room do not overbook;
- missing availability row fails closed;
- capacity/guest limits are enforced;
- Tour schedule cannot exceed capacity;
- same idempotency key + same payload returns one result;
- same idempotency key + changed payload fails.

### Food/Shop

- DB price wins over caller price;
- shop stock cannot go negative under concurrency;
- order transaction rolls back atomically on failure;
- changed-cart idempotency replay fails;
- delivery checkout remains fail-closed until delivery-fee authority exists.

### Storage

- partner can upload only for own business/owner record;
- partner A cannot mutate partner B object/metadata;
- public catalog receives short-lived signed media only where policy allows;
- delete compensation works;
- bucket remains private.

### Payments

- browser roles cannot mutate payment truth;
- provider event replay is idempotent;
- conflicting replay fails closed;
- paid amount must equal internal authoritative amount;
- refund event does not auto-refund;
- `order_payments` projection stays synchronized.

### Delivery

- non-dispatcher assignment denied;
- only active courier role/profile can be assigned;
- courier progression is exactly one canonical step at a time;
- wrong courier cannot progress another delivery;
- delivery and normalized assignment remain consistent;
- payment truth never changes from delivery RPCs.

## Final staging acceptance

After all 19 layers:

1. run `supabase/staging/999_postflight_read_only.sql`;
2. rerun Supabase Security Advisor;
3. rerun Performance Advisor;
4. perform rollback rehearsal;
5. deploy the exact tested commit to Vercel staging;
6. run full Client → Partner → Payment → Courier → Admin E2E;
7. only then prepare a production pilot decision.

## Current infrastructure blockers

As of preparation:

- Supabase development/staging branches: `0`;
- KÖL Vercel project: not created;
- live migration ledger: absent;
- live Storage buckets/objects: `0`;
- live payments: `0`.

These are infrastructure gates, not reasons to weaken source checks or apply the drafts directly to live.
