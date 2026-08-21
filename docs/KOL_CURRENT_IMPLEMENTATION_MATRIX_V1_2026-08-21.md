# KÖL — CURRENT IMPLEMENTATION MATRIX V1

**Date:** 2026-08-21  
**Project:** KÖL / `kol-travel-platform`  
**Purpose:** factual KÖL-only implementation map separating UI/source presence, locally proven transaction behavior, live Supabase state and remaining product gaps.

## Status legend

- **MAIN_SURFACE** — route/source exists on current `main`; this alone does not prove production behavior.
- **MAIN_INFRA** — infrastructure is merged to `main` and CI-proven.
- **DRAFT_PROVEN_LOCAL** — source exists in the current Gate-1 integration candidate and passed disposable local Supabase proof; it is not live-applied.
- **PARTIAL** — meaningful source exists, but the complete real E2E flow is not yet accepted.
- **LIVE_NOT_APPLIED** — planned/proven source has not been applied to recovered live Supabase.
- **OWNER_GATE** — cannot be finalized without an explicit owner business/security/production decision.
- **NOT_PRODUCTION** — must not be represented as production-ready.

---

## 1. Current source / platform foundation

| Component | Current status | Evidence / interpretation | Next acceptance step |
|---|---|---|---|
| Git source of truth | MAIN_INFRA | Separate private repository `stvelikiy-star/kol-travel-platform`; current recovery `main` is established | Keep all KÖL work isolated in this repo |
| Framework | MAIN_INFRA | Next.js 16.3.1 / React 19 / TypeScript / Node >=22 | Maintain green deterministic CI |
| CI | MAIN_INFRA | Locked install, dependency audit, schema/staging checks, deployment safety checks, lint, typecheck, production build | Keep required checks green on consolidation PRs |
| Local Supabase smoke | MAIN_INFRA | Disposable PostgreSQL/Auth/Storage staging workflow exists and destroys its local stack after proof | Continue using it as pre-live regression gate |
| Gate-1 integration candidate | DRAFT_PROVEN_LOCAL | PR #45 combines security, transactions, payment, delivery, Storage, proof and Gate-1 docs | Do not merge/apply live without explicit source/live approval |
| Master project context | DRAFT_PROVEN_LOCAL | PR #46 contains KÖL-only V6 product/strategy/current-state context; KÖL CI passes | Keep synchronized with verified state |

---

## 2. Public customer verticals

| Module | UI/source on `main` | Transaction authority | Current truth | Priority gap |
|---|---|---|---|---|
| KÖL Stay | `/stays`, `/stays/[slug]` | Booking RPC stack is in Gate-1 candidate | MAIN_SURFACE + DRAFT_PROVEN_LOCAL | Real restored-live/staging E2E: search → availability → booking → approved payment → confirmation |
| KÖL Tours | `/tours`, `/tours/[slug]` | Tour booking RPC stack is in Gate-1 candidate | MAIN_SURFACE + DRAFT_PROVEN_LOCAL | Real schedule/slot fixtures + complete paid booking E2E |
| KÖL Food | `/food`, `/food/[restaurantSlug]` | Food/Shop order transaction core exists in Gate-1 candidate | MAIN_SURFACE + PARTIAL | Full real menu → cart → partner acceptance → fulfillment/delivery E2E; do not invent ingredient inventory |
| KÖL Shop | `/shop`, `/shop/[shopSlug]` | Atomic order/stock core locally concurrency-proven | MAIN_SURFACE + DRAFT_PROVEN_LOCAL | Real catalog/stock fixtures + checkout/payment/delivery E2E |
| Cart | `/cart` route exists | Order totals must remain DB-authoritative | MAIN_SURFACE + PARTIAL | Verify cart normalization and server-authoritative checkout wiring end-to-end |
| Checkout | `/checkout` route exists | Payment/order creation must use trusted server/DB paths | MAIN_SURFACE + PARTIAL | Connect only after provider/business rules and controlled staging acceptance |
| Booking flow | `/booking` route exists | Stay/Tour authoritative booking RPCs locally proven in candidate | MAIN_SURFACE + DRAFT_PROVEN_LOCAL | Wire/verify real customer flow against approved staging target |

### Core acceptance definition

KÖL core is not considered done because a route renders.

- **Stay:** search → real availability → booking → approved payment flow → confirmation.
- **Tours:** search → real slot → booking → approved payment flow → confirmation.
- **Food:** menu → cart → order → partner acceptance → fulfillment/delivery → completion.
- **Shop:** catalog → cart → stock validation → order → atomic stock mutation → fulfillment/delivery → completion.

---

## 3. Client account

Current `main` contains a dedicated Client surface with:

- dashboard;
- bookings;
- orders;
- profile;
- favorites;
- offers;
- loyalty;
- support.

Source also contains client server-action layers for bookings, orders, profile, reviews and support, including both recovered/pilot and `*Real` adapters in some contours.

**Status:** MAIN_SURFACE + PARTIAL.

**Do not infer:** production data truth, production Auth acceptance, payment settlement or full cross-surface E2E merely from route/action presence.

**Next acceptance:** authenticated staging user journey across profile → booking/order → status/history → support, with cross-user isolation tests.

---

## 4. Partner account

Current `main` contains a broad Partner surface:

- dashboard;
- catalog;
- availability;
- bookings;
- orders;
- delivery;
- finance;
- analytics;
- reviews;
- promos;
- settings;
- stop control.

Partner actions exist for availability, bookings, catalog, media, orders and stop control. Some order contours have explicit real adapters.

**Status:** MAIN_SURFACE + PARTIAL.

**What is already technically important:** partner ownership/tenant boundaries are part of the RLS/security hardening stack; browser direct writes to authoritative transaction truth are intentionally restricted in the staged target.

**Next acceptance:** one real staging partner per vertical, catalog/availability mutation tests, order/booking operation tests, STOP behavior, media ownership and cross-partner denial tests.

---

## 5. Admin / operations

Current `main` contains Admin routes for:

- bookings;
- orders;
- clients;
- partners;
- couriers;
- catalog;
- moderation;
- delivery;
- finance;
- users;
- settings;
- AI dispatcher surface.

Admin action layers exist for delivery, finance, moderation, settings and users. The repository also preserves multiple admin read-pilot/audit documents from the recovery process.

**Status:** MAIN_SURFACE + PARTIAL.

**Next acceptance:** role-verified staging admin, read/write operation matrix, audit trail checks and explicit denial for non-admin roles.

---

## 6. Courier / delivery

Current `main` contains Courier routes for:

- active delivery;
- deliveries;
- dispatcher;
- earnings;
- history;
- issues;
- profile.

Courier action layers exist for deliveries, real delivery operations, issues and profile.

Gate-1 candidate locally proves the canonical delivery state machine, including role/state transition enforcement, assignment cleanup, courier availability restoration, history and idempotent terminal replay.

**Status:** MAIN_SURFACE + DRAFT_PROVEN_LOCAL + LIVE_NOT_APPLIED.

**Not yet approved:** production courier operations, delivery pricing, force completion/failure policy, reassignment policy after acceptance, proof-of-delivery/GPS and courier payout rules.

---

## 7. Auth / RBAC / tenant isolation

- Supabase SSR/Auth infrastructure exists in source.
- Role-protected surfaces exist for Client, Partner, Courier and Admin.
- Recovered live Supabase has RLS enabled on all 54 public base tables but the old live policy baseline is incomplete.
- Gate-1 staged security sequence closes policy gaps, recursion/search-path issues and dangerous direct mutation paths.
- The full staged target passed local structural checks with zero policy-less RLS public tables.

**Status:** MAIN_INFRA + DRAFT_PROVEN_LOCAL + LIVE_NOT_APPLIED.

**Production blockers:** real backup/baseline, controlled staging RBAC/cross-tenant acceptance, leaked-password protection decision and explicit live apply approval.

---

## 8. Booking transaction integrity

### Stay
Locally proved in the Gate-1 candidate:

- DB-authoritative price;
- inventory row locking;
- no negative availability;
- same-key idempotent replay;
- changed payload conflict;
- real two-session last-room race with exactly one successful booking.

### Tours
Locally proved:

- DB-authoritative price;
- capacity mutation once under replay;
- changed participant payload conflict.

**Status:** DRAFT_PROVEN_LOCAL + LIVE_NOT_APPLIED.

---

## 9. Food / Shop order transaction integrity

Staged order core provides:

- caller identity derived server-side;
- DB-authoritative catalog prices;
- minimum order enforcement for Food where authoritative data exists;
- deterministic product locking and atomic stock decrement for Shop;
- idempotency and changed-payload rejection;
- atomic order/items/history/audit behavior;
- direct browser/session mutation lockdown for transaction truth.

Shop last-item concurrency and no-oversell behavior are locally proved.

Food does **not** have an invented ingredient inventory model; absence of ingredient stock authority is intentionally respected.

**Status:** DRAFT_PROVEN_LOCAL for transaction core; Food complete E2E remains PARTIAL; LIVE_NOT_APPLIED.

---

## 10. Payments

Provider-neutral payment integrity exists in the Gate-1 candidate and locally proves:

- amount derived from authoritative parent total;
- attempt creation;
- provider reference/event idempotency;
- replay-conflict rejection by payload hash;
- amount mismatch cannot settle parent;
- payment + parent settlement projection is atomic;
- automatic refund application remains OFF;
- minimum service-role ACL required by the trusted payment RPC path is explicitly staged and verified.

**Status:** DRAFT_PROVEN_LOCAL + OWNER_GATE + LIVE_NOT_APPLIED.

**Still intentionally unresolved:** payment provider, signature adapter/webhook endpoint, commissions/service fees, cancellation/refund/no-show rules, partner payouts.

No real charge/refund has occurred.

---

## 11. Catalog media / Storage

- Recovered live Supabase last had zero buckets and zero objects.
- Gate-1 candidate defines a private `catalog-media` design.
- Local staging proves the bucket remains private and Storage metadata/index invariants hold.
- Partner media source uses authenticated ownership/RLS rather than browser service-role bypass.

**Status:** DRAFT_PROVEN_LOCAL + LIVE_NOT_APPLIED.

**Next acceptance:** approved staging target + role-by-role upload/read/delete tests + restore/backup handling for object bytes separately from DB backup.

---

## 12. Reviews, favorites, offers, loyalty, promos, analytics, support

These features have meaningful route/source evidence across Client and Partner surfaces.

**Status:** MAIN_SURFACE / PARTIAL.

They are **not** release-critical before the four historical transaction cores. Loyalty, complex promotion logic, advanced analytics and AI must not delay Stay/Tours/Food/Shop E2E acceptance.

---

## 13. Search / maps / notifications / external automation

These are part of the KÖL target product, but this matrix does not mark them production-ready without a dedicated current integration audit.

**Status:** PARTIAL / TO AUDIT.

Future audit must separately verify:

- map/geocoding provider and key handling;
- search source and ranking/filter behavior;
- transactional notifications;
- email/SMS/push if used;
- n8n/WhatsApp/Telegram only if KÖL actually requires them;
- analytics provider and consent/privacy boundary.

Do not import integrations from any other project into KÖL by analogy.

---

## 14. AI

AI dispatcher/assistant source surfaces exist, but AI is not authoritative for business truth.

Hard rule:

**AI may assist discovery, support, summarization, moderation and operational triage, but may not invent or override price, inventory, availability, booking/order confirmation, payment/refund state, delivery fee or payout truth.**

**Status:** PARTIAL / NON-CORE PRIORITY.

---

## 15. Production infrastructure

| Item | Current truth |
|---|---|
| Live Supabase | Recovered project exists and is healthy, but Gate-1 SQL is not live-applied |
| Migration ledger | Historical live ledger absent; must not be fabricated |
| Authoritative logical backup for Gate 1 | Not yet executed/accepted |
| Remote paid staging | Not established/approved |
| KÖL Vercel production project | Not established in last verified audit |
| Production domain | Not established in current verified technical state |
| Production env/secrets | Not accepted |
| Real payment provider | Not selected/connected |
| Production release | NOT AUTHORIZED |

---

## 16. Current readiness interpretation

### Strongly proven now

- recovered KÖL source is independently versioned;
- modern Next/React source builds under CI;
- public vertical routes exist;
- Client/Partner/Admin/Courier surfaces exist;
- local Supabase staging can reproduce the recovered baseline and staged migration sequence;
- Stay/Tour booking integrity is locally proved;
- Shop stock/order integrity is locally concurrency-proved;
- payment integrity core is locally proved provider-neutrally;
- delivery state-machine integrity is locally proved;
- staged RLS/security/index invariants are locally proved;
- Gate-1 consolidation PR #45 has both normal KÖL CI and Local Supabase Staging Smoke passing;
- Master Context V6 PR #46 has normal KÖL CI passing.

### Not proven / not authorized yet

- real restored-live migration execution;
- remote staging rehearsal from an authoritative live backup;
- complete role-by-role E2E on that remote/approved target;
- real provider payment signature/capture/refund path;
- live partner/courier operating model;
- production deployment;
- production financial reconciliation.

---

## 17. Next work order

### P0 — Source consolidation

1. Keep PR #45 as the deterministic pre-live Gate-1 candidate.
2. Keep PR #46 as the KÖL-only product/strategy/current-state documentation branch.
3. Keep all CI green and review diffs for accidental cross-project content or secrets.
4. Do not silently merge source PRs while explicit source merge permission is absent.

### P1 — Gate 1 owner action

When explicitly authorized:

1. capture read-only live evidence;
2. create real logical DB backup/schema baseline;
3. checksum and store backup safely;
4. perform restore test / controlled staging rehearsal;
5. run frozen staged sequence with per-layer VERIFY and stop-on-failure discipline.

### P2 — Controlled E2E acceptance

- Client Auth/RBAC and isolation;
- Stay E2E;
- Tours E2E;
- Food E2E;
- Shop E2E;
- Partner operations per vertical;
- Admin operations;
- Courier lifecycle;
- media ownership;
- payment integrity with a selected provider test adapter only after owner decision.

### P3 — Pilot readiness

Only after P2:

- real pilot geography;
- real partner data;
- operational support/reconciliation;
- observability and rollback acceptance;
- explicit production approval.

---

## 18. KÖL-only boundary

This matrix is exclusively for KÖL.

Do not copy business rules, booking rules, CRM schemas, contacts, prices, credentials, n8n workflows, Google resources, Telegram groups or operational assumptions from PALADIN, AK BERMET, cottage.kg, Nova Print, Rot Front, Marinad or any other project.

When evidence conflicts, priority is:

1. explicit current KÖL owner decision;
2. current KÖL GitHub `main` / verified PR state;
3. current live/staging KÖL infrastructure evidence;
4. fresh KÖL tests/audits;
5. latest KÖL master context;
6. older KÖL recovery documents.

---

**Current conclusion:** KÖL has substantial real application surfaces and a materially proven transaction/security core in isolated staging, but the correct next milestone is not feature inflation. It is controlled Gate-1 backup/rehearsal followed by role-by-role E2E acceptance of the four core verticals.