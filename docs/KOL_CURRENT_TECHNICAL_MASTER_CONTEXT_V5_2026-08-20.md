# KÖL — CURRENT TECHNICAL MASTER CONTEXT V5

**Date:** 2026-08-20  
**Project:** KÖL / KOL / `kol-travel-platform`  
**Repository:** `stvelikiy-star/kol-travel-platform`  
**Status:** SOURCE STABILIZATION COMPLETE / STAGING INFRASTRUCTURE GATED / PRODUCTION NOT READY  
**Supersedes:** V4 and its addendum for current-state claims.

---

## 0. Strict project boundary

This document is only for KÖL. Do not import assumptions, credentials, data models, deployment state or business rules from any other project.

KÖL is an Issyk-Kul marketplace / super-app with four core domains:

1. Tours
2. Stay / Accommodation
3. Food
4. Shop

Application roles/surfaces:

- Client
- Partner
- Courier
- Admin / Operations

Architecture rule: PostgreSQL/Supabase is authoritative for transactional truth. AI and frontend clients must not invent price, inventory, availability, booking/order/payment state or delivery truth.

Alcohol remains disabled until explicit legal/product approval.

---

## 1. Current Git source of truth

Default branch: `main`.

Current confirmed main after the 2026-08-20 stabilization sequence:

`fdd996e76eaa01aa6699c4f7d18018c152abf333`

This commit includes source-only stabilization through:

- RLS/security baseline V2
- exact FK index baseline
- atomic Stay/Tour booking V2
- atomic Food/Shop order V2
- catalog media Storage V2
- payment integrity V2
- delivery lifecycle V2
- release/staging readiness V2

Historical pre-recovery Git lineage remains unavailable and must never be fabricated.

Old pre-V2 stabilization PRs were closed after their corrected V2 replacements were merged. Their history remains available for audit but they are no longer current implementation guidance.

---

## 2. Current application/runtime stack

Current stabilized source uses:

- Next.js `16.3.1`
- React `19.x`
- Node.js `>=22`
- TypeScript `5.7.x`
- Tailwind CSS `3.4.x`
- `@supabase/ssr` `0.12.4`
- `@supabase/supabase-js` `2.111.0`
- tracked `package-lock.json`

The Next 14/15 state in older contexts is obsolete.

Production dependency security gate:

`npm audit --omit=dev --audit-level=high`

was proven green on the current stabilization path after the Next 16 upgrade.

---

## 3. Current CI truth

GitHub Actions exists on `main` and runs for pull requests, pushes to main and manual dispatch.

Current required pipeline:

1. `npm ci`
2. production dependency audit
3. recovered Supabase schema-file manifest
4. deployment environment preflight
5. deployment fail-closed self-tests
6. ESLint
7. TypeScript no-emit
8. Next.js production build in intentional mock mode

Release/Staging Readiness V2 run #72 passed all of these checks before merge.

The deployment self-test specifically proves:

- development + mock + alcohol off => PASS
- production + mock => FAIL
- production + Supabase public config => PASS
- alcohol enabled => FAIL
- secret-like `NEXT_PUBLIC_*SERVICE_ROLE*` configuration => FAIL

Do not call a future commit PASS unless its checks actually run.

---

## 4. Current live Supabase project

Project: `kol-travel-platform-test`  
Ref: `mphruawzozrpwcjgejhs`  
Region: `ap-northeast-2` / Seoul  
PostgreSQL: `17.6.1.127`

Latest read-only baseline refresh on 2026-08-20:

- public tables: **54**
- RLS enabled: **54 / 54**
- public RLS policies: **46**
- RLS-enabled tables with zero policies: **26**
- public helper/trigger functions: **6**
- public indexes: **99**
- payments rows: **0**
- Storage buckets: **0**
- Storage objects: **0**
- `supabase_migrations.schema_migrations`: **absent**

No stabilization SQL in main has been applied to this live project.

The latest V5 metadata fingerprints were generated with a refreshed canonicalization query and therefore must not be compared byte-for-byte to earlier V4 fingerprints that used a different serialization method:

- columns: `e9159596376116173889e5b73c4ab068`
- policies: `4332b6648ee2abad1366e568355f818b`
- functions: `f1303bece08e96528de13fa77d7ba295`
- indexes: `04ddc9c99ef9437c8dbc408013fceb2d`

These are drift guardrails only, never a backup substitute.

---

## 5. Live security state remains unchanged

Because the source SQL has not been applied live, the live backend still retains the previously verified recovery defects, including:

- recursive `user_roles -> is_admin()/has_role() -> user_roles` behavior
- recursive partner staff helper/policy risk
- six public functions without the hardened fixed search path
- 26 RLS-enabled tables without policies
- broad authenticated write grants on several transactional contours
- leaked-password protection still requiring owner/manual security-setting action

Source fixes exist in main, but SOURCE MERGED is not the same as DATABASE APPLIED.

---

## 6. Source stabilization package now in main

### Security / RLS

Current main carries `005` through `006c` drafts and verification support:

- recursion fixes
- fixed search paths
- explicit public catalog grant/policy contract
- conservative policy completion
- audit-log direct-write lockdown
- init-plan/scope hardening
- transaction entrypoint lockdown

### FK performance baseline

`010` adds exactly the 49 leading FK indexes found missing by the live catalog audit. Additive only; no index drops.

### Stay / Tour booking

`007`, `007a`, `007b` establish:

- DB-authoritative pricing
- deterministic inventory locks
- capacity/availability enforcement
- no caller-supplied monetary truth
- direct-write lockdown
- serialized idempotency
- payload-conflict rejection

No cancellation/refund/no-show rules are invented.

### Food / Shop orders

`008`, `008a` establish:

- DB-authoritative menu/product prices
- shop stock authority in `products.stock_qty`
- deterministic product locking and atomic decrement
- restaurant minimum-order enforcement
- strict cart/idempotency replay contract
- direct order/order-delivery write lockdown

Delivery remains pickup-only at checkout until an authoritative delivery-pricing model exists.

### Catalog media / Storage

Storage V2 uses a private `catalog-media` contract:

- 8 MiB maximum
- JPEG / PNG / WebP / AVIF
- SVG excluded
- business/owner-scoped canonical paths
- partner-scoped authenticated upload/delete
- public active catalog uses short-lived signed URLs

Important V2 correction: bucket provisioning/checking is performed through the Supabase Storage API helper. SQL `009` then validates the expected bucket and applies application metadata/RLS. Live Storage remains empty.

### Payment integrity

`011`, `011a`, `011b` provide a provider-neutral integrity layer:

- service-role-only payment mutation path
- amount/user derived from authoritative parent order/booking
- provider-reference serialization/idempotency
- immutable provider identity
- provider-event replay conflict guard
- exact amount match for paid settlement
- private event ledger without raw provider payload
- strict SHA-256 payload hash boundary
- `order_payments` projection consistency
- direct payment/order-payment mutation lockdown
- automatic refund application OFF

No provider has been selected and no webhook/signature implementation is fabricated.

### Delivery lifecycle

`012`, `012a`, `012b` provide:

- direct delivery mutation lockdown
- dispatcher/super-admin assignment boundary
- active courier role/profile requirement
- canonical courier state machine
- recovered assignment backfill candidate
- normalized assignment consistency
- deferred delivery/assignment/profile invariants
- payment truth untouched by delivery flow

Canonical physical progression:

`courier_assigned -> courier_accepted -> courier_to_partner -> arrived_at_partner -> picked_up -> courier_to_client -> arrived_at_client -> delivered`

Live recovered mismatch still exists until staging/live migration is intentionally applied: one active delivery has `assigned_courier_id`, while normalized `courier_assignments` is empty and courier profile is still online.

---

## 7. Production / deployment safety now in main

Next 16 `src/proxy.ts` now fails unsafe environments closed.

Production requires:

- `DATA_SOURCE_MODE=supabase`
- public Supabase URL
- publishable/anon public key
- alcohol disabled

Unsafe production requests return generic HTTP 503.

`/api/health` intentionally remains reachable and reports safe non-secret readiness metadata only. It explicitly reports:

`databaseConnectivity: not_checked`

so configuration readiness is never misrepresented as a live DB health check.

Request correlation uses `x-request-id`; unsafe/missing ids are regenerated.

---

## 8. Vercel current state

Connected Vercel team was freshly rechecked after source stabilization.

There is still **no KÖL / kol-travel-platform Vercel project**.

Therefore:

- KÖL staging deployment: NOT CREATED
- KÖL production deployment: NOT CREATED
- KÖL domain: NOT CREATED
- KÖL Vercel environment variables: NOT CONFIGURED

The connected Vercel toolset can inspect projects/deployments and deploy a current linked project, but it does not expose a safe create-project action for this unlinked KÖL repository in the current session.

No deployment was attempted.

---

## 9. Supabase staging current state

Supabase development branches: **0**.

Creating a development branch is cost-bearing and requires explicit cost confirmation. Do not create one silently.

The current connector does not expose a logical-backup/export operation sufficient to satisfy the required pre-migration recovery contract.

Therefore database staging apply remains blocked by two real infrastructure prerequisites:

1. fresh logical DB backup/export + accepted migration/schema baseline
2. dedicated staging Supabase target

Do not use the live recovery DB as an ad-hoc staging environment.

---

## 10. Authoritative staged apply order

Only after backup/baseline + dedicated staging:

1. `005_security_hardening_DRAFT_NOT_APPLIED.sql`
2. `005a_partner_policy_scope_DRAFT_NOT_APPLIED.sql`
3. `006_rls_policy_completion_DRAFT_NOT_APPLIED.sql`
4. `006a_audit_log_write_lockdown_DRAFT_NOT_APPLIED.sql`
5. `006b_rls_initplan_scope_hardening_DRAFT_NOT_APPLIED.sql`
6. `006c_transaction_entrypoint_lockdown_DRAFT_NOT_APPLIED.sql`
7. `010_fk_index_baseline_DRAFT_NOT_APPLIED.sql`
8. `007_booking_transaction_core_DRAFT_NOT_APPLIED.sql`
9. `007a_booking_direct_write_lockdown_DRAFT_NOT_APPLIED.sql`
10. `007b_booking_idempotency_serialization_DRAFT_NOT_APPLIED.sql`
11. `008_order_transaction_core_DRAFT_NOT_APPLIED.sql`
12. `008a_order_idempotency_payload_hardening_DRAFT_NOT_APPLIED.sql`
13. provision/check staging `catalog-media` through Storage API
14. `009_catalog_media_storage_DRAFT_NOT_APPLIED.sql`
15. `011_payment_integrity_DRAFT_NOT_APPLIED.sql`
16. `011a_payment_event_replay_conflict_guard_DRAFT_NOT_APPLIED.sql`
17. `011b_payment_projection_hardening_DRAFT_NOT_APPLIED.sql`
18. `012_delivery_lifecycle_DRAFT_NOT_APPLIED.sql`
19. `012a_delivery_assignment_consistency_DRAFT_NOT_APPLIED.sql`
20. `012b_delivery_role_consistency_hardening_DRAFT_NOT_APPLIED.sql`

Run each corresponding VERIFY plus role/concurrency/invariant tests before the next layer.

---

## 11. Mandatory staging proof

### Security
- no RLS recursion
- client sees own data only
- partner A cannot access partner B
- courier cannot access another courier's delivery mutation path
- admin roles behave only within intended authority
- no browser/session direct mutation of protected transactional truth

### Booking
- concurrent Stay last-room test
- missing date inventory fails closed
- Tour capacity concurrency
- exact idempotent replay returns same result
- same key + changed payload fails

### Food / Shop
- shop stock never negative under concurrency
- no second decrement on retry
- DB price is authoritative
- inactive/foreign-business item denied
- delivery request remains fail-closed until pricing model exists

### Storage
- exact private bucket contract
- cross-business path forgery denied
- invalid MIME/oversize denied
- signed reads only for eligible catalog
- metadata/object compensation verified

### Payment
- provider-reference concurrency
- event replay/conflicting replay
- wrong amount rejected
- valid settlement updates payment + parent atomically
- order-payment projection consistent
- refund event recorded but not auto-applied

### Delivery
- 012a repairs recovered normalized assignment mismatch
- role checks enforced
- no skipped transitions
- wrong courier denied
- active delivery has one matching assignment + busy courier
- terminal delivery has no active assignment
- payment status unchanged

---

## 12. Business / owner gates that remain intentionally unresolved

Batch these decisions; do not interrupt for them one by one:

- actual payment provider
- customer payment methods
- KÖL commission/service fee
- authoritative delivery fee/pricing model
- cancellation/refund/no-show policy
- partner/courier payout rules
- provider secrets/signature credentials
- production RPO/RTO
- final production release approval

Alcohol remains OFF.

---

## 13. Current no-go rules

Until staging and owner gates pass:

- no live SQL apply
- no destructive migration
- no fabricated migration history
- no paid Supabase branch without explicit cost confirmation
- no production deployment
- no real payment activation
- no automatic refund
- no invented delivery pricing
- no alcohol activation
- no production secrets in Git/docs
- no AI-generated transactional truth
- no claim of PASS without executed evidence

---

## 14. Immediate next milestone

Source stabilization is now substantially complete.

Current milestone:

`KOL_STAGING_PROOF_001 — BACKUP + DEDICATED STAGING + MIGRATION/ROLE/CONCURRENCY PROOF`

The next productive path is:

`logical backup/baseline -> dedicated Supabase staging -> ordered DB apply + VERIFY -> role/concurrency tests -> Storage proof -> payment integrity proof without provider activation -> delivery proof -> Vercel staging project/deploy -> end-to-end QA -> owner production gates`

Until the first two infrastructure prerequisites exist, keep live KÖL unchanged.

---

**END — KÖL CURRENT TECHNICAL MASTER CONTEXT V5 — 2026-08-20**
