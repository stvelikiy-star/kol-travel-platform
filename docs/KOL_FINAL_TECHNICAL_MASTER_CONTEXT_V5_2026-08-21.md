# KÖL — FINAL TECHNICAL MASTER CONTEXT V5

**Date:** 2026-08-21  
**Project:** KÖL / KOL / `kol-travel-platform`  
**Repository:** `stvelikiy-star/kol-travel-platform`  
**Status:** SOURCE + LOCAL-STAGING CORE PROVEN / LIVE MIGRATION + PRODUCTION NOT AUTHORIZED

This document is the current technical handoff for KÖL. It separates facts already merged to `main`, facts proved only in draft branches/local disposable staging, and owner-controlled production gates.

---

## 0. Executive truth

KÖL is an Issyk-Kul marketplace / super-app with four core domains:

1. Tours / Activities
2. Accommodation / Stay
3. Food Delivery
4. Shop / Marketplace

Primary product principle:

**ONE ECOSYSTEM / ONE ACCOUNT / ONE TRANSACTIONAL CORE**

Application roles/surfaces:

- Client
- Partner
- Courier
- Admin

Supabase/PostgreSQL is the intended transactional authority for price, inventory, availability, booking/order/payment state and authorization-sensitive mutations.

AI is an interface/assistant only. It must not invent authoritative prices, stock, availability, booking confirmation, payment state, refund state or fees.

KÖL is **not production-authorized** yet. Source and disposable local-staging confidence are now materially higher, but live DB apply, real payments and production deploy remain gated.

---

## 1. Current Git source of truth

Recovery baseline:

`7e713b19f6c73c329c09df1163afba17c5443096`

Current `main` at creation of this V5 context:

`1cb37e622ae2818debc514f6a372747a3dc2a132`

That `main` includes the merged local Supabase staging-smoke foundation. Later verified work described below remains in draft PRs and must not be treated as merged until Git says so.

No Git history before the recovery baseline should be fabricated.

---

## 2. Current framework/runtime on `main`

Confirmed current application baseline:

- Next.js `16.3.1`
- React / React DOM `19.2.x`
- TypeScript `5.7.x`
- Node engine `>=22`
- ESLint 9 flat config
- Tailwind CSS `3.4.x`
- `@supabase/ssr` `0.12.4`
- `@supabase/supabase-js` `2.111.0`

Next.js 16 migration work already moved the project to async App Router request APIs and the `proxy.ts` convention.

Production source guard is fail-closed: unsafe production mock mode, unsafe alcohol enablement and public service-role exposure scenarios are blocked by checks.

---

## 3. CI baseline

Normal KÖL CI currently verifies:

1. locked dependency install (`npm ci`)
2. production dependency audit
3. recovered Supabase schema manifest
4. staging execution package
5. deployment environment preflight
6. deployment fail-closed scenarios
7. ESLint
8. TypeScript no-emit
9. Next production build in intentional mock mode

PR #40 adds a permanent **full dependency graph HIGH audit** on top of the production-only audit. That addition is proven but not merged at the time of this document.

---

## 4. Live Supabase — last verified read-only baseline

Project:

- name: `kol-travel-platform-test`
- ref: `mphruawzozrpwcjgejhs`
- region: Seoul / `ap-northeast-2`
- PostgreSQL: `17.6.1.127`
- health: `ACTIVE_HEALTHY`

Read-only inventory verified 2026-08-20:

- public base tables: **54**
- RLS enabled: **54 / 54**
- public policies: **46**
- RLS-enabled tables with zero policies: **26**
- public helper/trigger functions: **6**
- public indexes: **99**
- Auth users: **4** recovery/demo users
- payments rows: **0**
- Storage buckets: **0**
- Storage objects: **0**
- Supabase migration ledger: **absent**
- Supabase development branches: **0** at the last check

No live SQL/Auth/Storage write was performed while creating or proving the current draft migration stack.

---

## 5. Live migration integrity

Critical fact:

`supabase_migrations.schema_migrations` is absent in live Supabase.

Therefore recovered SQL files are not a trustworthy historical migration ledger merely because they exist in Git.

Stage-21 additive catalog fields were still absent in the last live read-only audit, including examples such as:

- `menu_items.slug`
- `products.slug`
- `tours.image_url`
- `stays.capacity`

A real logical DB backup/schema baseline and accepted rollback procedure are mandatory before any live apply.

Disposable local Supabase proof is **not** a substitute for that backup.

---

## 6. Live security facts that motivated the draft stack

The 2026-08-20 live read-only audit identified:

- role-policy recursion path through `user_roles -> is_admin() -> has_role() -> user_roles`;
- partner-staff recursion risk through `partner_staff -> is_partner_for() -> partner_staff`;
- six public helper/trigger functions without fixed search path;
- 26 RLS-enabled public tables with zero policies;
- leaked-password protection disabled;
- broad authenticated/service-role grants requiring explicit least-privilege handling;
- 49 missing valid/ready leading indexes for single-column public foreign keys.

The draft security/transaction stack is designed to address these findings without inventing a migration history.

---

## 7. Draft staging execution sequence — NOT LIVE APPLIED

The current locally exercised sequence is:

`005 → 005a → 006 → 006a → 006b → 006c → 010 → 007 → 007a → 007b → 008 → 008a → 009 → 009a → 011 → 011a → 011b → 011c → 012 → 012a → 012b`

All apply files remain explicitly named `DRAFT_NOT_APPLIED`.

High-level layers:

- `005..006c`: RLS/security/grant/direct-write hardening
- `010`: foreign-key index baseline
- `007..007b`: Stay/Tour booking transaction + idempotency serialization
- `008..008a`: Food/Shop order transaction + payload/idempotency hardening
- `009..009a`: private catalog media Storage + FK-index correction
- `011..011c`: provider-neutral payment integrity, replay guard, projection hardening and minimum `service_role` ACL required by SECURITY INVOKER RPCs
- `012..012b`: delivery lifecycle, assignment consistency and role/state hardening

---

## 8. PR #39 — transactional/local Supabase functional proof

PR #39: `KÖL: prove local transaction behavior and concurrency`

- status: draft/open
- head: `e8830ad388b5db76efd4e9e3c62820cbd39c4c65`
- mergeable at last check: yes
- live apply: no

Proof:

- KOL CI run `32408679214`: PASS
- Local Supabase Staging Smoke run `32408679201`: PASS
- 21/21 migration layers applied to a disposable local PostgreSQL/Auth/Storage stack

Functionally proved:

### Stay

- same-idempotency-key replay creates one booking effect;
- authoritative DB pricing;
- changed payload under same key rejected;
- two-session last-room race serializes correctly;
- inventory does not go negative.

### Tour

- replay increments capacity only once;
- authoritative DB pricing;
- changed participant payload under same key rejected.

### Shop

- normalized equivalent carts replay to one order;
- stock decremented once;
- subtotal/total DB-authoritative;
- changed cart under same key rejected;
- two-session last-item race produces exactly one successful order and no oversell.

### Payment

- payment attempt derives amount from authoritative parent total;
- verified paid event settles payment + parent atomically;
- exact provider event replay applied once;
- same provider/event id with changed payload hash fails closed;
- amount mismatch cannot settle parent;
- refund event can be recorded but automatic refund remains OFF.

### Delivery

- client cannot dispatch or advance courier-only transitions;
- courier cannot skip canonical transitions;
- canonical lifecycle reaches delivered;
- terminal active assignment is removed;
- courier becomes available again;
- payment truth is not mutated by delivery lifecycle;
- history records canonical transitions;
- terminal same-status replay is idempotent.

### Structural invariants after full local sequence

- 54/54 public tables still RLS enabled;
- zero RLS-enabled public tables remain without a policy in the staged target;
- six helper functions have fixed search path;
- browser/session direct mutation remains closed for authoritative transaction/audit/payment/delivery tables;
- required transactional RPCs exist;
- payment RPCs are closed to anon/authenticated and executable by `service_role`;
- zero missing leading indexes remain for the checked single-column public FKs;
- `catalog-media` remains private.

Important: these are disposable-local results, not evidence that live Supabase has been modified.

---

## 9. Payment ACL correction discovered by functional testing

Functional testing exposed a real permission dependency in the SECURITY INVOKER payment path.

Draft `011c_payment_service_role_acl_DRAFT_NOT_APPLIED.sql` adds only the trusted-server ACL needed by the RPC path:

- `orders`: SELECT + UPDATE
- `bookings`: SELECT + UPDATE
- `payments`: SELECT + INSERT + UPDATE
- `order_payments`: SELECT + INSERT (SELECT is required by the `ON CONFLICT` path)
- `audit_logs`: INSERT

Browser/session mutation remains closed. `011c` has a fail-closed verification layer.

---

## 10. PR #40 — dependency hardening

PR #40: `KÖL: eliminate remaining dev dependency HIGH finding`

- status: draft/open
- base: `main`
- head: `bc39a469a83e4ac8f0ea5345e00d42ff3110c7ea`
- mergeable at last check: yes
- changed files: exactly 2

Exact fix:

- `package.json`: unchanged
- root dev/tooling `brace-expansion`: `1.1.15 → 1.1.18`
- modern nested `brace-expansion 5.0.9`: unchanged
- permanent full dependency `npm audit --audit-level=high` gate added to CI

Final proof:

- KOL CI run `32410302609`: FULL PASS
- `npm ci`: 0 vulnerabilities
- production audit: 0 vulnerabilities
- full dependency graph audit: 0 vulnerabilities
- schema/staging/deployment/lint/TypeScript/build: PASS
- Local Supabase smoke run `32410302546`: PASS

No `npm audit fix --force` was used.

---

## 11. PR #41 — Next internal navigation lint cleanup

PR #41: `KÖL: restore Next internal-link lint rule`

- status: draft/open
- current base: PR #40 branch
- head: `a8f22984e67b58bb95223d6df9881d010e379140`
- mergeable at last check: yes

Exact fix:

- removes temporary `@next/next/no-html-link-for-pages: off` exception;
- converts the 17 lint-reported literal internal `<a href="/...">` cases across 13 TSX files to `next/link`;
- changes no business/data/payment/booking/order/delivery logic.

Temporary codemod/write CI used to produce the mechanical edits was removed before final diff.

Combined proof while stacked on PR #40:

KOL CI run `32411427169`: **FULL PASS**

- locked install: PASS
- production audit: PASS
- full dependency graph audit: PASS
- schema manifest: PASS
- staging package: PASS
- deployment guards: PASS
- lint with rule restored: PASS
- TypeScript: PASS
- Next.js 16.3.1 production build: PASS

A zero-content commit was used only to force GitHub to regenerate the stacked PR merge ref; it changes no files.

---

## 12. Safe source merge order — only after explicit approval

Do not infer merge permission from autonomous source-work permission.

When explicit source-merge approval is given:

1. merge PR #40 into `main`;
2. retarget PR #41 back to the updated `main`;
3. require a fresh green CI against the new `main` base;
4. merge PR #41 only if that run remains green;
5. evaluate PR #39 separately; its local DB proof must never be interpreted as authorization to apply SQL live.

---

## 13. Auth and authorization

Source contains real Supabase SSR/Auth infrastructure and role guards.

Authorization-sensitive server logic must use validated user identity rather than trusting client-submitted role/ownership information.

Production Auth acceptance remains gated by:

- real staging/live-target RBAC and cross-tenant isolation acceptance;
- leaked-password protection decision/enablement;
- migration/security baseline acceptance.

---

## 14. Storage

Last verified live state:

- buckets: 0
- objects: 0

The staged `catalog-media` design is private and locally verified. That does not mean a live bucket exists.

Database backup and Storage backup are separate concerns and must not be conflated.

---

## 15. Payments

Current payment work is provider-neutral technical infrastructure only.

Technically proved locally:

- authoritative amount derivation;
- attempt creation;
- provider-event idempotency;
- replay conflict handling;
- amount mismatch rejection;
- parent settlement projection;
- refund auto-application OFF.

Not approved/invented:

- payment provider;
- commission/service fee;
- delivery fee policy;
- cancellation/refund/no-show rules;
- partner payout rules.

No real charge or refund has occurred.

---

## 16. Delivery

Draft delivery lifecycle is DB-authoritative and locally functionally proved.

Canonical contour includes assignment, courier acceptance/progression and terminal delivery cleanup with role/state checks.

No real courier production workflow is claimed.

---

## 17. Vercel / production

Last checked connected Vercel team did not contain an established KÖL production/staging project.

Therefore, unless newer explicit evidence exists:

- KÖL Vercel staging: NOT ESTABLISHED
- KÖL Vercel production: NOT ESTABLISHED
- production domain: NOT ESTABLISHED
- production env/secrets: NOT ACCEPTED

Do not deploy production before owner gates are satisfied.

---

## 18. Consolidated owner gates

Issue #16 is the operational owner-gate checklist.

### Gate 1 — authoritative DB backup / migration baseline

Before live SQL:

- real logical DB backup/schema dump;
- accepted baseline;
- rollback procedure;
- no fabricated migration history.

### Gate 2 — Auth leaked-password protection

Supabase Security Advisor last reported it disabled. Resolve before production Auth acceptance.

### Gate 3 — payment/business rules

Owner must approve provider and financial/cancellation/payout rules.

### Gate 4 — production secrets/environment

Secrets must be configured through hosting/Supabase secret systems and never committed.

### Gate 5 — production release

Explicit owner approval required before:

- live DB migration;
- real payment enablement;
- Vercel production deployment.

---

## 19. Production acceptance minimum

Before production approval require at least:

1. accepted logical DB backup/schema baseline and rollback procedure;
2. controlled migration rehearsal on an approved staging target or equivalent isolated environment;
3. E2E/RBAC/transaction/concurrency verification against that target;
4. Auth leaked-password protection decision/enablement;
5. approved provider + fees + cancellation/refund/no-show + payout rules;
6. production secrets and live Supabase configuration;
7. observability/rollback acceptance;
8. explicit production approval.

---

## 20. Hard no-go rules

Never:

- apply SQL to live Supabase without explicit approval + real backup/baseline;
- mutate live Auth/Storage merely to complete a test;
- create a cost-bearing Supabase branch without cost confirmation;
- deploy production without approval;
- enable payments or alcohol without approval;
- invent fees/provider/refund/cancellation/payout rules;
- claim a migration ledger exists when it does not;
- treat schema fingerprints as a backup;
- treat DB backup as Storage backup;
- use `npm audit fix --force` as a blind remediation;
- claim draft/local migration results are already live;
- silently merge draft PRs.

---

## 21. Immediate technical next state

Source-only work can continue autonomously with:

- documentation/context synchronization;
- PR/diff audits;
- staging runbooks;
- rollback/backup procedures;
- additional fail-closed verification;
- safe CI improvements;
- preparation for a real approved staging/live-baseline step.

The next material boundary is no longer “can the transaction design work?” — disposable local proof shows that it can under the tested contracts. The next boundary is **controlled transition from recovered live schema to an authoritative backup/migration baseline and approved staging/release process**.
