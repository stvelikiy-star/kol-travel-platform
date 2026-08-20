# KÖL — FINAL TECHNICAL MASTER CONTEXT V4

**Date:** 2026-08-20  
**Project:** KÖL / KOL / `kol-travel-platform`  
**Status:** RECOVERED SOURCE OF TRUTH / SECURITY + TRANSACTION STABILIZATION / PRODUCTION NOT READY  
**Supersedes:** `KOL_FINAL_TECHNICAL_MASTER_CONTEXT_V3_2026-08-12.md` for current technical-state claims.

---

## 0. Executive truth

KÖL is an existing Issyk-Kul marketplace / super-app with four recovered core domains:

1. Tours
2. Accommodation / Stay
3. Food
4. Shop

The project is no longer in the state described by V3 where a Git source of truth was missing. A clean recovery baseline was established in GitHub on 2026-08-13 and subsequent reviewed work was merged through 2026-08-14.

Current Git source of truth:

- repository: `stvelikiy-star/kol-travel-platform`
- visibility: private
- default/base branch: `main`
- current confirmed `main` before the 2026-08-20 draft work: `a413fb6fb5b5361b3aeab9de6801050704370896`
- recovered historical Git history before the new baseline: **not recovered**

Current Supabase backend is live and healthy:

- project: `kol-travel-platform-test`
- ref: `mphruawzozrpwcjgejhs`
- region: `ap-northeast-2` / Seoul
- PostgreSQL: `17.6.1.127`
- verified status on 2026-08-20: `ACTIVE_HEALTHY`

KÖL is **not production-ready**. Current primary blockers are database backup/migration baseline, RLS completion, production Auth/RBAC proof, transactional booking/order integrity, Storage, payment provider/business rules, staging/E2E/concurrency/rollback and deployment.

---

## 1. Product architecture

Recovered product principle:

**ONE ECOSYSTEM / ONE ACCOUNT / ONE TRANSACTIONAL CORE**

Application surfaces present in source include:

- public marketplace/catalog;
- client cabinet;
- partner cabinet;
- courier cabinet;
- admin/operations cabinet;
- Auth/ownership/audit helpers;
- multiple Supabase read adapters;
- AI Dispatcher skeleton.

AI is not a transactional authority. Availability, price, inventory, booking/order/payment truth must come from deterministic server/database logic.

---

## 2. Current application stack

Current `package.json` on `main` confirms:

- Next.js `14.2.23`
- React `18.3.1`
- TypeScript `5.7.3`
- Tailwind CSS `3.4.17`
- `@supabase/ssr` `0.12.4`
- `@supabase/supabase-js` `2.111.0`
- npm / `package-lock.json`

The older V3 statement that `@supabase/supabase-js` was not a declared dependency is now obsolete.

Historical recovery build proof from 2026-08-12:

- compile: PASS
- lint/type validation: PASS
- static generation: 130/130
- build traces/final optimization: PASS

Current 2026-08-20 draft branches still require fresh CI/local checks before merge.

---

## 3. Git recovery and work after V3

Recovery baseline commit:

`7e713b19f6c73c329c09df1163afba17c5443096`

Confirmed merged recovery/Phase 3 work after baseline includes:

- source baseline cleanup;
- remote control smoke proof;
- Phase 3 source completion;
- RBAC regression/cabinet integrity;
- client Favorites/Loyalty read contour;
- partner CRM recovery;
- live Supabase schema correction in source adapters;
- Auth/cabinet read validation;
- client cabinet read integrity audit.

Latest merged `main` commit before current drafts:

`a413fb6fb5b5361b3aeab9de6801050704370896`

No historical commits before the recovery baseline should be fabricated.

---

## 4. Current live Supabase inventory

Read-only live inspection on 2026-08-20:

- public base tables: **54**
- RLS enabled: **54 / 54**
- public RLS policies: **46**
- RLS-enabled tables with zero policies: **26**
- public helper/trigger functions: **6**
- public indexes: **99**
- Auth users: **4**
- payments rows: **0**
- Storage buckets: **0**
- Storage objects: **0**

The live dataset is still demo/recovery data, not production customer data.

---

## 5. Migration integrity

Critical current fact:

`supabase_migrations.schema_migrations` is absent in the live project.

Therefore the current database does not have a trustworthy Supabase migration ledger. Existing files under `supabase/schema/` are recovered/manual schema artifacts and drafts; their existence is not proof that each was applied as a tracked migration.

Stage 21 additive catalog fields remain unapplied in the live database. Explicitly rechecked as absent on 2026-08-20:

- `menu_items.slug`
- `products.slug`
- `tours.image_url`
- `stays.capacity`

No new SQL should be applied to live until a logical backup and an authoritative migration baseline/rollback strategy exist.

---

## 6. Current schema fingerprints

Live metadata fingerprints captured 2026-08-20:

- columns: `cd623ef2b347cde915bca33a42f73894`
- RLS policies: `64a042b02b039bd9cac451c571d3de52`
- public functions: `08f2c73926db9d6e2eea8d11218c8a42`
- indexes: `a23e64b3dc1e70662353fc6378a9be3c`

These are drift guardrails, not a substitute for a real dump/backup.

---

## 7. Confirmed live RLS/security defects

### 7.1 Recursive role policy

Confirmed loop:

`user_roles policy -> is_admin() -> has_role() -> user_roles policy`

Live policy `admins read roles` calls `is_admin()`, while `has_role()` reads `user_roles`.

### 7.2 Recursive partner staff policy

Confirmed loop risk:

`partner_staff policy -> is_partner_for() -> partner_staff policy`

### 7.3 Mutable function search path

Supabase Security Advisor currently flags all six public helper/trigger functions:

- `set_updated_at`
- `has_role`
- `is_admin`
- `is_finance_admin`
- `is_partner_for`
- `is_assigned_courier`

### 7.4 RLS policy coverage

26 public tables currently have RLS enabled but no policies. This is fail-closed for normal API roles, but it also means intended features are incomplete.

### 7.5 Auth password protection

Supabase Security Advisor reports leaked-password protection disabled.

### 7.6 Data API grant drift

Live inspection found authenticated/service-role privileges on current catalog tables but no anon SELECT grants on the inspected public catalog contour. RLS and table grants are independent, so public catalog access requires an explicit grant contract.

---

## 8. Current Auth source state

Source now contains real Supabase SSR/Auth infrastructure:

- browser client;
- server client;
- middleware session refresh;
- `auth.getUser()` server validation;
- profile/role helpers;
- route guards for client/partner/courier/admin.

Auth route protection is enabled when `DATA_SOURCE_MODE=supabase`.

Current default data-source mode remains intentional `mock` for recovery/development. A production safety draft has been prepared so a real production environment cannot silently launch in mock mode.

Production tenant isolation is not accepted until real role-by-role RLS tests pass against staging.

---

## 9. Current booking/inventory schema truth

### Stay

Live schema has:

- `rooms` with business, capacity, price/status;
- `room_availability` with date/status/available_count/price_override;
- `UNIQUE(room_id,date)`.

There are currently zero live `room_availability` rows.

### Tours

Live schema has:

- `tours` with business/price/status;
- `tour_schedules` with date/time/capacity/booked_count/status.

There are currently zero live `tour_schedules` rows.

### Booking

Live `bookings` is polymorphic through `booking_type` + `object_id` and also stores dates, guest count, total, payment status and metadata.

The recovered demo booking uses:

- `booking_type='tour'`
- `object_id=tour.id`

There is currently no proven production atomic booking transaction preventing concurrent oversell.

---

## 10. Current write/transaction state

Historical source already contains an early controlled partner order-status write pilot.

That does not make the platform transactional core complete.

Still not production-proven:

- Stay no-overbooking transaction;
- Tour schedule capacity transaction;
- Food/Shop stock/order transaction;
- payment capture/webhook/reconciliation;
- cancellation/refund inventory release;
- courier assignment/write lifecycle;
- external callback idempotency.

A new source-only atomic Stay/Tour booking draft was prepared 2026-08-20, using DB row locks, DB-side price calculation and idempotency. It has NOT been applied.

---

## 11. Storage / Edge Functions

Current live state:

- Storage buckets: 0
- Storage objects: 0
- no confirmed deployed Edge Functions in the recovered project

Media upload/storage policy work remains required before partner media is production-ready.

---

## 12. External integrations

Existing source/env contracts indicate Supabase, n8n, Telegram and WhatsApp intentions, but current recovery has not proved live production behavior for:

- n8n KÖL workflows;
- customer WhatsApp bot;
- operations Telegram bot;
- payment provider;
- maps provider;
- Google Sheets CRM;
- production notification delivery.

Do not mark an integration DONE based only on env names or old plans.

---

## 13. Vercel / deployment

Connected AI PROF Vercel team was rechecked on 2026-08-20.

KÖL is not present as a current Vercel project in that team.

Therefore:

- staging deployment: NOT ESTABLISHED
- production deployment: NOT ESTABLISHED
- production URL: NOT ESTABLISHED
- production monitoring baseline: NOT ESTABLISHED

No deployment should occur before security/migration/staging gates.

---

## 14. Current 2026-08-20 draft work

### KÖL repository

- PR #13 — `KÖL: live-audited RLS security baseline`
  - draft/open
  - source-only
  - includes security/RLS migration drafts, verification SQL, schema fingerprint and CI baseline
  - no live DB mutation

- PR #14 — `KÖL: fail closed on unsafe production data source`
  - draft/open
  - source-only
  - blocks misconfigured production instead of silently serving mock/demo state

- PR #15 — `KÖL: atomic stay and tour booking transaction draft`
  - draft/open
  - source-only
  - atomic DB-side Stay/Tour booking design with locks + idempotency
  - no live DB mutation

- Issue #16 — consolidated owner-only gates
  - backup/migration baseline
  - Auth leaked-password setting
  - payment/business rules
  - production secrets
  - final production release approval

### AI PROF Control Center

A draft project registration has been prepared so KÖL becomes an explicit separate project package rather than relying on historical Repair Team references.

---

## 15. CI state

A GitHub Actions CI workflow has been prepared in PR #13 with:

- `npm ci`
- schema-file presence check
- lint
- TypeScript no-emit check
- production build in intentional mock mode

As of preparation of this V4 context, GitHub had not registered a workflow run for the draft branch. Therefore no new 2026-08-20 CI PASS is claimed.

Historical build PASS remains evidence for recovered source health only.

---

## 16. Current implementation matrix

| Area | Current status |
|---|---|
| Product concept | RECOVERED / STABLE |
| Local source | RECOVERED |
| GitHub source of truth | PASS |
| Git historical lineage | LOST BEFORE RECOVERY BASELINE |
| Main branch | PASS |
| Historical recovery build | PASS |
| Fresh 2026-08-20 CI | NOT YET RUN |
| Supabase project | ACTIVE_HEALTHY |
| DB schema | PRESENT / DRIFT-RISK UNTIL BASELINE |
| Migration ledger | MISSING |
| Auth backend/source | PARTIAL / REAL FOUNDATION EXISTS |
| Production Auth/RBAC E2E | NOT ACCEPTED |
| RLS enabled | 54/54 |
| RLS policy coverage | PARTIAL, 26 TABLES FAIL-CLOSED |
| RLS recursion | CONFIRMED / DRAFT FIX PREPARED |
| Public catalog reads | IMPLEMENTED SOURCE / GRANT-RLS FIX DRAFTED |
| Partner/Admin reads | IMPLEMENTED SIGNIFICANTLY |
| Client reads | IMPLEMENTED SIGNIFICANTLY |
| Courier reads | IMPLEMENTED PILOTS |
| Real writes | EARLY PILOTS |
| Stay booking transaction | DRAFT PREPARED / NOT APPLIED |
| Tour capacity transaction | DRAFT PREPARED / NOT APPLIED |
| Food/Shop transaction core | INCOMPLETE |
| Payments | NOT IMPLEMENTED LIVE |
| Refunds | INCOMPLETE |
| Storage | EMPTY |
| Maps | PROVIDER NOT CONFIRMED |
| n8n/WhatsApp/Telegram | UNVERIFIED LIVE |
| Vercel staging | NOT DEPLOYED |
| Vercel production | NOT DEPLOYED |
| Monitoring/rollback | NOT READY |
| AI Concierge | LATER, AFTER CORE |

---

## 17. Priority order from this point

### P0 — preserve / baseline

1. Real logical DB backup/schema dump.
2. Establish authoritative tracked migration baseline without fabricating history.
3. Confirm no unexpected schema fingerprint drift.

### P1 — security/Auth

1. Validate RLS recursion/search-path/grant drafts in staging.
2. Complete policies for all current tables with least privilege.
3. Role-by-role and cross-partner isolation tests.
4. Enable appropriate leaked-password protection.
5. Address verified RLS performance/index issues after correctness.

### P2 — transactional core

1. Initialize staging room/tour inventory.
2. Concurrent Stay booking tests.
3. Concurrent Tour schedule tests.
4. Food/Shop order + stock transaction core.
5. Cancellation/release transitions after business rules.
6. Idempotency across all external callbacks.

### P3 — platform services

1. Storage/media.
2. Payment abstraction/provider/webhook/reconciliation after owner decision.
3. Notifications.
4. Maps/search.
5. Support/finance hardening.

### P4 — staging / production readiness

1. Vercel staging.
2. E2E customer/partner/courier/admin flows.
3. Concurrency/load/security regression.
4. Backup restore + rollback proof.
5. Observability/health checks.
6. Production pilot only after explicit owner acceptance.

---

## 18. No-go rules

Until the required gates pass:

- no destructive SQL;
- no live schema migration without backup/baseline;
- no Stage 21 apply;
- no production deploy;
- no payment enablement;
- no alcohol enablement;
- no production secrets in Git/docs/tasks;
- no fake migration history;
- no fake historical Git history;
- no treating demo/mock data as production;
- no AI-created price/availability/payment truth;
- no claiming PASS for checks that were not actually executed.

---

## 19. Owner interruption policy

Technical work should continue autonomously wherever it can be done safely.

Batch owner-only decisions instead of interrupting separately for each item. Current owner-only gates are:

- payment provider;
- commissions/service fee/delivery fee policy;
- cancellation/refund/no-show policy;
- production secrets/credentials when automation cannot access them;
- destructive migration approval;
- final production release approval.

---

## 20. Current technical milestone

The project has moved beyond `KOL_RECOVERY_AUDIT_001` source discovery/Git recovery.

The current technical program is effectively:

`KOL_CORE_COMPLETION_001 — SECURITY + TRANSACTION STABILIZATION`

However production readiness remains blocked until P0/P1/P2 staging proof is completed.

---

**END — KÖL FINAL TECHNICAL MASTER CONTEXT V4 — 2026-08-20**
