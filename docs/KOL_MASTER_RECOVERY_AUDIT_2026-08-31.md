# KÖL TRAVEL PLATFORM — MASTER RECOVERY AUDIT

Date: 2026-08-31
Repository: `stvelikiy-star/kol-travel-platform`
Canonical main at audit: `10f73cb44fa8b8b004b03225737e0d91248c837e`
Status: CORE / AUTH / LOCAL SUPABASE TRANSACTION STACK SUBSTANTIALLY VERIFIED; CLIENT BOOKING BROWSER E2E IN PROGRESS; LIVE SUPABASE INACTIVE; PRODUCTION FAIL-CLOSED

> Evidence rule: IMPLEMENTED != VERIFIED. TEST EXISTS != PASS. LOCAL SUPABASE != LIVE SUPABASE. VERCEL READY != CURRENT PRODUCTION. PREVIEW != PRODUCTION.

## CURRENT

KÖL is a client-first travel marketplace with public Stay, Tours, Food and Shop surfaces plus role workspaces for Client, Partner, Courier and Admin/operations.

Current canonical `main` is `10f73cb44fa8b8b004b03225737e0d91248c837e`, produced by merged PR #65 (`test(auth): prove local Supabase session and RLS runtime`). `main` is not protected at audit time.

Current active development:
- PR #66 `test(booking): prove authenticated browser atomic booking runtime`, head `8c167ae11efb85d0614691df7f86eb11f54317e9`.
- PR #67 `feat(courier): wire real delivery progression UI`, stacked on PR #66, head `2fb60fcb2baf565e140dd64796b7c53eb2e6dc24`.

Live boundaries:
- Supabase project `kol-travel-platform-test` / `mphruawzozrpwcjgejhs`: INACTIVE at audit time.
- Vercel project `kol-travel-platform-app`: exists, but Git link is absent and latest READY deployments are not evidence of exact current GitHub `main` or PR #66. The older production-target deployment is historical.
- source production safety is intentionally fail-closed because `PRODUCTION_RUNTIME_IMPLEMENTATION_READY = false`.

## EVIDENCE REVIEWED

Repository/history:
- current `main` branch/commit/protection state;
- recent PR history including consolidation PR #51 and PRs #57–#67;
- open PR #66 and stacked #67;
- issue #16 P0 owner gates and evidence comments;
- exact-head workflow runs/logs for current booking E2E.

Architecture/source:
- `README.md`;
- `docs/API_ARCHITECTURE.md`;
- `src/lib/deployment-safety.ts`;
- public Supabase adapters and booking inventory model;
- real Client Stay/Tour booking actions/writer contract;
- Partner booking/availability/order actions;
- Admin delivery action;
- Courier delivery read/UI stacked change;
- legacy `/booking/checkout` route;
- staged Supabase migration/verification sequence and local staging smoke output.

Connected runtime metadata:
- Supabase project state;
- Vercel project/deployment metadata.

## WHAT WAS

The project evolved through three broad phases:

1. Presentation/MVP surfaces and role workspaces.
2. Recovery/security/data-integrity consolidation, culminating in PR #51, which merged a 322-commit recovery line into canonical `main` after exact-head 4/4 evidence.
3. Real Supabase runtime conversion: CI/runtime hardening, public reads, public inventory RPCs, Auth/RLS session proof and now real browser booking/operational role E2E.

Important recovered history:
- local Supabase staging smoke and transaction/concurrency proof established the database safety model;
- booking/order/payment/delivery atomic RPCs were built before browser integration;
- production was deliberately kept fail-closed rather than treating demo/previews as readiness proof;
- current work is no longer “build a marketplace from zero”; it is “finish real role workflows, external staging/live validation, then production gates”.

## CHANGES / RELEASE EVOLUTION

| Layer | Current evidence |
| --- | --- |
| Consolidated marketplace source | merged via PR #51 |
| Production environment fail-closed precedence | merged PR #57 |
| Current README recovery | merged PR #58 |
| CI Node 24 / Next config / dependency policy | merged PRs #59–#62 |
| Public Supabase list runtime | merged PR #63 |
| Stay/Tour detail + constrained inventory RPC | merged PR #64 |
| Real Auth/session/RLS browser runtime | merged PR #65 |
| Authenticated Stay/Tour browser booking | PR #66, NOT YET VERIFIED |
| Courier real progression UI | PR #67, IMPLEMENTED STACKED / NOT YET VERIFIED |

## WHAT IS NOW — ARCHITECTURE

KÖL is currently a Next.js application backed by a staged Supabase/PostgreSQL operational core.

Authority model:
- public/read traffic uses server-side Supabase-aware data adapters;
- authenticated role actions use server actions / authenticated Supabase RPCs;
- browser does not receive monetary/client identity authority for booking/order transactions;
- PostgreSQL/RPC functions own pricing, inventory, capacity, payment projection and delivery state transitions;
- RLS remains the row-authorization layer;
- production safety is a source + environment gate, not an environment variable alone.

This architecture is coherent for the current scope. No rewrite/microservice split is justified by the evidence.

## VERIFIED

### Repository / CI
- current merged `main` contains real Auth/session/RLS proof from PR #65;
- PR #65 exact head had KOL CI, Public Flows, Local Supabase Staging Smoke and Visual QA all success;
- post-merge exact-main KOL CI success was recorded in issue #16 evidence.

### Auth / RLS
Verified in isolated real local Supabase runtime:
- real Client / Partner / Courier / Admin Auth users;
- real `/login` browser flow;
- SSR cookie/session;
- role workspace routing;
- unauthenticated route guard;
- cross-role denial;
- same-role horizontal RLS isolation;
- 54/54 public tables RLS enabled;
- authenticated SELECT ACL 54/54 while row visibility remains RLS-controlled;
- zero public tables without RLS in the tested baseline.

### Public runtime
Verified in local Supabase staging:
- `/stays`, `/tours`, `/food`, `/shop` load Supabase records;
- Stay/Tour detail pages load real catalog data;
- constrained anonymous Stay/Tour inventory RPCs work;
- raw anonymous inventory table SELECT remains denied;
- no silent mock fallback is accepted when Supabase mode fails.

### Transaction/data-integrity core
Verified in local staging transaction/concurrency suites:
- Stay booking atomicity and server-derived total;
- Stay inventory decrement exactly once;
- idempotency and changed-payload conflict;
- last-room two-session race protection;
- Tour capacity and server price;
- Tour idempotency;
- Food/Shop order DB-authoritative totals/stock;
- order idempotency and last-item race protection;
- payment attempt amount from authoritative parent total;
- provider event dedupe / replay conflict protection;
- payment projection constraints;
- automatic refund remains disabled;
- delivery assignment authorization;
- canonical courier delivery state machine;
- no status skipping;
- terminal delivery cleanup/history;
- payment truth is not changed by delivery lifecycle.

### Security/dependencies
Latest local #193 setup/output confirms:
- application npm install/audit reports zero vulnerabilities in the tested package tree;
- isolated Playwright 1.62.1 audit reports zero vulnerabilities;
- Supabase CLI is pinned/deterministically installed in the Local smoke;
- RLS/table privileges and service-role-only payment RPC boundaries are checked in the staging package.

## IMPLEMENTED NOT VERIFIED

### PR #66 — authenticated browser booking
Implemented:
- guest Stay booking fail-closed;
- real Client login;
- real Stay booking panel submission;
- strict DB truth assertions;
- UI-generated idempotency replay;
- real Tour booking equivalent;
- Client `/client/bookings` readback.

Current exact-head evidence is only **3/4 green**:
- KOL CI: SUCCESS;
- Public Flows: SUCCESS;
- Visual QA: SUCCESS;
- Local Supabase Staging Smoke #193: FAILURE.

Root cause from #193:
- guest booking denial passed;
- Client Auth/session passed;
- browser returned to the correct Stay detail URL;
- real Stay page and booking panel rendered;
- E2E then expected stale exact H1 `Demo guest house`;
- actual current seeded/rendered H1 was `Презентационный режим guest house`.

Therefore the current blocker is a stale browser fixture/assertion, not currently evidenced failure of Auth, public Supabase read, or booking RPC. However authenticated Stay submit + DB assertions, Tour submit and final Client readback were NOT REACHED in that run and therefore are NOT VERIFIED yet.

### PR #67 — Courier operational UI
Implemented on stacked branch:
- `/courier/active` calls the existing real atomic courier transition action;
- UI exposes only the next canonical delivery transition;
- Courier read adapter uses `deliveries.status` rather than incorrectly reusing `orders.status`.

PR #67 currently cannot be accepted independently because it is stacked on #66 and its Local smoke fails in the inherited booking test before Courier-specific runtime can become final evidence.

### Admin assignment
`assignCourierAction` is a real server action with dispatcher/super-admin role guard and `assign_courier_atomic` RPC.

Operational browser assignment/read-model E2E is not yet fully proven.

## PARTIAL

### Partner
Real:
- Auth/RLS session layer;
- Partner order `mark ready for pickup` server action backed by atomic DB writer.

Still demo/TODO on current main:
- booking confirm;
- booking reject;
- guest arrival;
- booking issue escalation;
- confirmed booking cancellation request persistence;
- availability date block/unblock;
- availability slot block;
- availability note write;
- availability conflict persistence.

These files explicitly return demo action results and state that no real operational data is changed.

### Courier
- backend delivery state machine: real/proven locally;
- current-main role/Auth: real/proven;
- current-main operational UI/read state: incomplete; PR #67 repairs it.

### Admin
- role/Auth: real/proven;
- some real delivery operations exist;
- wider admin moderation/finance/settings/user operations still contain presentation/demo boundaries and require per-action verification before production claims.

### Client
- Auth and existing booking read model are real;
- full real browser booking creation is pending #66 exact-head green evidence.

### Payments
Database integrity core exists and is locally proven. Real payment provider/provider credentials/refund/no-show/payout rules and production acceptance are owner/provider gates, not currently enabled product truth.

## BROKEN

1. **PR #66 stale E2E fixture/title assertion.**
   Current Local smoke expects a historical exact Stay H1 that no longer matches the rendered seed title.

2. **Legacy `/booking/checkout` remains presentation/mock-only.**
   It imports `mockStays` / `mockTours`, computes a preliminary value client-side and explicitly says no booking is created in presentation mode. It is not the real Supabase booking path now used by Stay/Tour detail panels.

3. **Partner booking operations remain demo/TODO.**

4. **Partner availability mutations remain demo/TODO.**

5. **Courier current-main read/UI mismatch.**
   PR #67 identifies/fixes use of order status where delivery status should be authoritative.

6. **README documentation drift.**
   It still contains presentation-era statements that conflict with later real Auth/Supabase/atomic runtime already merged into main.

## UNKNOWN

- current live Supabase database contents/migration state because the project is INACTIVE and was not restored;
- live RLS/Auth behavior after any future restore;
- real provider payment behavior;
- final refund/cancellation/no-show/payout business policy;
- exact current-production behavior of Vercel because latest READY deployments are not proven to correspond to current `main`;
- real operational load/performance/SLOs;
- final production secrets/config validity;
- real mobile/browser provider acceptance on a current external staging release.

## BLOCKED

Production is blocked by issue #16 gates:
1. live Supabase restore/unpause authorization and billing implication;
2. fresh live read-only baseline and authoritative backup/rollback proof;
3. isolated current staging/preview acceptance;
4. Auth/security acceptance on restored environment;
5. payment provider and exact business rules;
6. production secrets/configuration;
7. Client/Partner/Courier/Admin end-to-end operational acceptance;
8. reviewed source change enabling production implementation readiness only after the above;
9. exact accepted production deployment + post-deploy health/E2E;
10. explicit final owner production approval.

No audit result authorizes any of those mutations.

## CRITICAL ERRORS

### P0-A — Current Client booking browser proof is red
Impact: real Client booking path cannot yet be called browser-verified.
Root cause currently evidenced: stale title assertion stops the test before the real authenticated submit.
Fix: update the fixture contract to the canonical actual seed value or stable DB-derived expected title; preserve strict post-submit DB assertions; rerun exact-head 4/4 and repeat Local on the same SHA.

### P0-B — Live Supabase is INACTIVE
Impact: live database/Auth/RLS runtime cannot be verified.
Fix: owner-authorized restore only after backup/billing decision. Do not restore during source audit.

### P0-C — Production readiness source flag is intentionally false
Impact: current source correctly blocks business production.
Fix: none now. Flip only after all release gates pass.

### P1-A — Partner operational bookings/availability are demo
Impact: Partner workspace is not fully operational.
Fix: implement ownership/status-transition constrained server actions against existing Core tables/RPC model, with audit and browser/DB E2E.

### P1-B — Courier operational UI not yet in canonical main
Impact: real backend cannot yet be considered complete end-user Courier flow.
Fix: finalize #66, rebase/reconcile #67 to main, exact-head tests, merge only after independent evidence.

### P1-C — `main` is unprotected
Impact: governance/accidental push risk.
Fix: branch protection after explicit governance authorization; do not mutate automatically.

## BUSINESS RULE / AUTHORITY FINDINGS

No inspected current transaction path gives browser caller monetary authority over Stay/Tour/order totals.

Current architecture explicitly requires:
- authenticated identity from session/Auth, not request body;
- DB-authoritative price/total;
- no direct browser DML to transaction truth tables;
- atomic state-machine RPCs for booking/order/payment/delivery.

Business rules that are not approved in KÖL — especially payment provider/refund/no-show/payout policy — must remain UNKNOWN/OWNER GATE and must not be imported from another hotel project.

## SECURITY FINDINGS

Positive:
- 54/54 RLS coverage in isolated staging proof;
- horizontal isolation test coverage;
- role server guards;
- direct transaction DML lockdown;
- payment RPC privilege separation;
- private catalog media storage model;
- fail-closed production environment logic;
- dependency audits currently clean in exact Local smoke setup.

Open:
- live restored Supabase security state is unknown until authorized read-only baseline;
- branch protection absent;
- production secrets/providers not verified;
- full production Auth security acceptance remains owner gate;
- legacy presentation routes should not accidentally be mistaken for authoritative booking paths.

## DATA INTEGRITY / CONCURRENCY

Strongest current project area.

Local proof covers:
- serializable/idempotent booking behavior;
- concurrent last-room and last-stock race protection;
- no negative inventory/oversell;
- payload-bound idempotency;
- provider event replay conflict detection;
- payment projection consistency;
- delivery assignment/state consistency;
- audit/history records;
- temporal booking guards;
- strict FK/index/RLS staging invariants.

Current browser gap does not invalidate these DB proofs, but it means the complete browser -> server action -> RPC -> DB -> readback chain is not yet verified on exact #66 head.

## ARCHITECTURE FINDINGS

1. Current architecture should be extended, not rewritten.
2. Supabase/PostgreSQL transactional RPC layer is the strongest authority boundary and should remain authoritative.
3. Public catalog and protected role actions have intentionally different access patterns.
4. Real role UI should call proven server actions/RPC state machines rather than create a second business-logic layer.
5. Legacy presentation routes should be retired or clearly isolated once their routing value is proven unnecessary.
6. Production fail-closed source flag is correct and should remain false until release acceptance.

## DOCUMENTATION DRIFT

DRIFT-01 — README simultaneously describes presentation-only limitations and later real Auth/Supabase/transaction capabilities. It needs a factual current-state update after PR #66 is resolved.

DRIFT-02 — historical `/booking/checkout` presentation flow remains in source alongside real detail-page booking actions and can confuse future maintainers/AI agents about the canonical path.

DRIFT-03 — Vercel READY deployments can be mistaken for current source deployment even though project Git link is null and current SHA linkage is not established.

## PREVIOUS PLAN

Recovered current plan:
1. prove public Supabase runtime;
2. prove real Auth/session/RLS for all roles;
3. prove Client real Stay/Tour browser booking end-to-end;
4. prove Partner/Courier/Admin operational role workflows;
5. remove/repair remaining demo operational gaps;
6. establish current isolated staging/preview evidence;
7. only then approach live Supabase restore/baseline/backups;
8. resolve payment provider/business rules;
9. enable production runtime only through reviewed source + environment gates;
10. exact production deployment and final acceptance.

## PREVIOUS PLAN STATUS

| Plan item | Status |
| --- | --- |
| Public Supabase runtime | VERIFIED LOCAL |
| Public Stay/Tour inventory | VERIFIED LOCAL |
| Client/Partner/Courier/Admin Auth/session | VERIFIED LOCAL |
| RLS/horizontal isolation | VERIFIED LOCAL |
| Atomic Stay/Tour/order/payment/delivery DB core | VERIFIED LOCAL |
| Client browser booking | IN PROGRESS — #66 RED 3/4 |
| Partner operational E2E | PARTIAL / NOT COMPLETE |
| Courier operational UI | STACKED #67 / NOT CURRENT MAIN |
| Admin operational E2E | PARTIAL / NOT COMPLETE |
| Current external staging | NOT VERIFIED |
| Live Supabase | INACTIVE / BLOCKED |
| Payment provider | OWNER GATE |
| Production runtime ready | FALSE BY SOURCE |
| Production release | NOT AUTHORIZED |

## TARGET VS CURRENT

| Domain | Target | Current | Status | Priority |
| --- | --- | --- | --- | --- |
| Public marketplace | real DB-backed catalogs | Stay/Tours/Food/Shop real local Supabase | VERIFIED LOCAL | P0 external later |
| Auth | real multi-role session | Client/Partner/Courier/Admin | VERIFIED LOCAL | preserve |
| RLS | least privilege + isolation | 54/54 + browser/RLS proof | VERIFIED LOCAL | preserve |
| Stay booking | browser -> atomic DB -> readback | implemented; E2E stopped by stale assertion | IMPLEMENTED NOT VERIFIED | P0 NOW |
| Tour booking | browser -> atomic DB -> readback | implemented; not reached in current failing run | IMPLEMENTED NOT VERIFIED | P0 NOW |
| Client cabinet | real own data | Auth/read model real | PARTIAL VERIFIED | P0/P1 |
| Partner orders | atomic state transition | real action exists | PARTIAL | P1 |
| Partner booking ops | real ownership/state machine | demo/TODO | BROKEN/PARTIAL | P1 |
| Partner availability | real protected writes | demo/TODO | BROKEN/PARTIAL | P1 |
| Courier backend | atomic delivery state machine | real/proven | VERIFIED LOCAL | preserve |
| Courier UI | real progression | PR #67 | IMPLEMENTED NOT VERIFIED | P1 |
| Admin delivery assignment | real role-protected RPC | action exists | PARTIAL | P1 |
| Payments | real provider + integrity | integrity core only | PARTIAL / OWNER GATE | P0 production |
| Deployment | exact current staging/prod | historical previews; live DB inactive | BLOCKED | P0 release |
| Governance | protected canonical main | unprotected main | GAP | P1 owner approval |

## GAP REGISTER

| ID | Gap | Severity | Next action |
| --- | --- | --- | --- |
| GAP-001 | PR #66 stale browser fixture assertion | P0 | repair assertion, rerun strict E2E |
| GAP-002 | Authenticated Stay/Tour browser DB proof incomplete | P0 | exact-head #66 4/4 + repeat Local |
| GAP-003 | Partner booking mutations demo | P1 | implement safe real state machine actions |
| GAP-004 | Partner availability mutations demo | P1 | implement protected real writes |
| GAP-005 | Courier UI/status authority not in main | P1 | reconcile #67 after #66 |
| GAP-006 | Admin operational E2E incomplete | P1 | real read model + assign flow browser/DB proof |
| GAP-007 | Legacy mock checkout route | P1/P2 | prove unused then retire/redirect or isolate |
| GAP-008 | README current-state drift | P2 | update after booking gate settles |
| GAP-009 | Live Supabase inactive | P0 release | owner gate, backup, restore, read-only baseline |
| GAP-010 | Current SHA -> Vercel staging evidence missing | P0 release | exact staging deployment after source gates |
| GAP-011 | Payment provider/rules unresolved | P0 production | owner decision/provider acceptance |
| GAP-012 | Branch protection absent | P1 governance | explicit governance approval |

## ERROR REGISTER

| ID | Severity | Domain | Problem | Impact | Fix |
| --- | --- | --- | --- | --- | --- |
| ERR-001 | P0 | Testing | stale exact Stay H1 in #66 E2E | blocks real browser booking proof | align expected fixture without weakening DB assertions |
| ERR-002 | P1 | Partner | booking actions return DemoActionResult | Partner cannot operate real booking lifecycle | server actions + ownership/state/audit |
| ERR-003 | P1 | Partner | availability actions are demo only | inventory control not operational | protected DB-backed mutations |
| ERR-004 | P1 | Courier | current-main reader conflates order/delivery status | wrong lifecycle UI semantics | #67 uses deliveries.status |
| ERR-005 | P1 | UX/Architecture | legacy checkout is mock presentation flow | canonical booking-path ambiguity | remove/redirect after routing proof |
| ERR-006 | P0 release | Supabase | live project INACTIVE | no live runtime evidence | authorized restore/baseline only |
| ERR-007 | P0 release | Vercel | no current exact-SHA production/staging linkage | READY deployment can be stale evidence | exact staging acceptance |
| ERR-008 | P1 | Governance | main unprotected | accidental direct changes possible | owner-approved protection/ruleset |

## DECISION REQUIRED

Owner decisions only where truly required:

1. **Live Supabase restore/unpause** — may have billing impact; requires explicit approval and backup/baseline plan.
2. **Payment provider and commercial rules** — provider, fees, cancellation/refund/no-show/payout semantics must not be invented.
3. **Production secrets/configuration** — explicit production change boundary.
4. **Final production approval** — after staging evidence.
5. **Branch protection policy** — governance mutation requires explicit approval.

No owner decision is required to fix #66 test drift, finish local role E2E, repair demo Partner actions in source/local staging, or update documentation.

## PLAN FROM CURRENT TO TARGET

### PHASE 0 — RECOVERY AUDIT
Status: COMPLETE.
- canonical main/current PRs recovered;
- Git/CI/Supabase/Vercel boundaries rechecked;
- architecture and transaction core audited;
- Partner/Courier/Admin/demo gaps isolated;
- plan reconciled with issue #16 gates.

### PHASE 1 — CLIENT TRANSACTION E2E
1. repair #66 stale fixture/title assertion only;
2. preserve hard-local guards and strict DB assertions;
3. fresh exact-head CI/Public/Visual/Local 4/4;
4. repeat Local smoke on same SHA to prove stability after prior flakes;
5. diff/security review;
6. merge exact expected head;
7. post-merge main CI;
8. record issue #16 evidence.

### PHASE 2 — ROLE OPERATIONS
1. rebase/reconcile #67 to new main;
2. prove Courier browser delivery progression + DB state/history;
3. prove Admin/Dispatcher assignment -> Courier chain;
4. prove real Partner order ready-for-pickup flow;
5. implement Partner booking state machine operations;
6. implement Partner availability protected mutations;
7. add wrong-role/cross-owner/state-skip/concurrency tests.

### PHASE 3 — CANONICAL UX / DOCS CLEANUP
- resolve legacy `/booking/checkout` path after routing evidence;
- align README/current architecture status;
- keep presentation mode clearly separate from real operational mode.

### PHASE 4 — EXTERNAL STAGING
- exact accepted main staging/preview;
- current SHA/deployment linkage;
- external Auth/role/public/booking/order/delivery browser E2E;
- no production promotion.

### PHASE 5 — LIVE SUPABASE / PAYMENTS OWNER GATES
Only with explicit owner approval:
- restore/unpause;
- read-only live baseline + authoritative backup/rollback;
- staged migration reconciliation;
- Auth security acceptance;
- payment provider and business rules;
- secrets.

### PHASE 6 — PRODUCTION
Only after all prior gates:
- reviewed source change for `PRODUCTION_RUNTIME_IMPLEMENTATION_READY`;
- `KOL_PRODUCTION_RUNTIME_READY=true` only in accepted production env;
- exact accepted deployment;
- post-deploy health/E2E;
- explicit owner final approval.

## ONE NEXT EXECUTABLE TASK

TASK ID: `KOL-P0-BOOKING-E2E-FIXTURE-DRIFT`

Goal: unblock PR #66 without weakening the test.

Exact work:
1. remove the stale hardcoded Stay-title expectation that no longer matches current seeded data;
2. bind the expectation to the actual canonical local fixture/DB value, or use a stable semantic detail-page marker in addition to strict object/DB ID assertions;
3. do not relax guest fail-closed, ownership, total, inventory, history, idempotency, capacity or Client readback assertions;
4. run exact-head 4/4;
5. run a second Local Supabase smoke on the same SHA;
6. merge only after both Local runs prove the complete authenticated Stay + Tour + readback chain.

Acceptance:
- guest attempt creates no booking/no inventory change;
- authenticated Stay creates exactly one authoritative DB booking;
- same idempotency key returns same booking/no extra decrement;
- Tour equivalent passes;
- `/client/bookings` shows both;
- all four PR workflows green on exact head;
- repeated Local smoke green on same SHA.

## OWNER-FACING SUMMARY

CURRENT: KÖL has a strong real local Supabase/Auth/RLS/atomic transaction core. It is no longer merely a presentation mock, but production is deliberately not enabled.

ACTION: full current Git/CI/source/Supabase/Vercel/role audit completed strictly for KÖL.

RESULT: no evidence requires a rewrite. The immediate red gate is a stale E2E fixture, while the larger functional gaps are Partner booking/availability and operational role browser completion. Live Supabase and production remain correctly blocked.

NEXT: fix PR #66 fixture drift -> exact-head 4/4 + repeated Local PASS -> merge -> Courier/Admin/Partner operational E2E.

BLOCKER: technical Client E2E blocker is source-test drift and can be fixed autonomously. Production blockers require owner approval only later.

OWNER ACTION NOW: none required for the next source/local-staging phase.
