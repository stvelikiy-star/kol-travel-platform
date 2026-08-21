# KÖL — E2E ACCEPTANCE PLAN V1

**Date:** 2026-08-21  
**Project:** KÖL / `kol-travel-platform`  
**Scope:** pre-production acceptance plan for the four KÖL core verticals and Client / Partner / Admin / Courier roles.

## 0. Purpose

This plan defines the minimum evidence required before KÖL can move from source/local-staging confidence to a controlled pilot.

It is deliberately written before remote/live rehearsal so that acceptance criteria cannot be weakened after failures are observed.

This document does **not** authorize:

- live Supabase mutation;
- production deployment;
- real payment capture/refund;
- cost-bearing staging resources;
- production partner/courier onboarding.

---

## 1. Test environment contract

E2E acceptance must run only against an explicitly approved isolated target created/restored under Gate 1.

Required environment facts must be recorded before tests:

- exact Git commit / PR head;
- exact migration manifest hash/order;
- target Supabase project/ref or isolated equivalent;
- database restore artifact checksum;
- schema baseline checksum;
- public app URL for the test target;
- test start timestamp;
- seeded fixture version;
- payment mode/provider adapter status;
- Storage bucket contract status.

Never run destructive E2E against the recovered live project unless separately and explicitly authorized.

---

## 2. Canonical fixture set

Use deterministic non-production fixtures.

### Users

- `client_a`
- `client_b`
- `partner_stay_a`
- `partner_tour_a`
- `partner_food_a`
- `partner_shop_a`
- `partner_other`
- `courier_a`
- `courier_b`
- `dispatcher_a`
- `admin_a`

### Stay

At minimum:

- one active property/business;
- two room/unit inventory objects;
- one date range with multiple available units;
- one date range with exactly one remaining unit;
- one unavailable date;
- explicit DB-authoritative prices.

### Tours

At minimum:

- one active tour;
- one schedule with spare capacity;
- one schedule with exactly one remaining participant slot;
- one closed/unavailable schedule;
- explicit DB-authoritative price.

### Food

At minimum:

- one active restaurant;
- active menu items;
- one inactive/unavailable menu item;
- restaurant minimum order if the schema/business row defines one;
- no invented ingredient-stock fixture unless an authoritative ingredient model exists.

### Shop

At minimum:

- one active shop;
- one product with normal stock;
- one product with exactly one item remaining;
- one out-of-stock product;
- DB-authoritative prices.

### Delivery

At minimum:

- one online courier;
- one second courier for ownership/assignment-negative tests;
- no stale active assignment before scenario start.

---

## 3. Global acceptance rules

Every scenario must prove, where applicable:

1. UI/action result;
2. authoritative DB state;
3. history/audit state;
4. ownership/RBAC boundary;
5. idempotency/replay behavior;
6. no unintended cross-module mutation;
7. no secret/raw provider payload exposure in user-visible errors/logs.

A rendered success page is not sufficient evidence by itself.

---

# 4. AUTH / RBAC / TENANT ISOLATION

## AUTH-001 — client authenticated access

**Actor:** client_a  
**Expected:** client account routes load; partner/admin/courier protected routes are denied/redirected according to the app contract.

## AUTH-002 — partner authenticated access

**Actor:** partner_stay_a  
**Expected:** own partner surface is available; admin/courier surfaces denied.

## AUTH-003 — courier authenticated access

**Actor:** courier_a  
**Expected:** courier surface is available; partner/admin operations denied.

## AUTH-004 — admin authenticated access

**Actor:** admin_a  
**Expected:** approved admin surface is available under admin role checks.

## AUTH-005 — cross-user client isolation

client_a must not read/update client_b private profile/order/booking rows through UI, server actions or direct authenticated Data API paths.

## AUTH-006 — cross-partner isolation

partner_stay_a must not mutate/read protected partner_other catalog, availability, bookings/orders or media outside the intentionally public catalog projection.

## AUTH-007 — direct authoritative-table DML denial

anon/authenticated browser/session clients must not directly mutate protected booking/order/payment/delivery/audit truth tables where staged RPC/server authority is required.

## AUTH-008 — role escalation denial

No client-controlled role/partner/business identifier may grant effective privilege beyond the validated server identity.

---

# 5. KÖL STAY

## STAY-001 — public discovery

- active stay appears in `/stays`;
- detail route resolves;
- inactive/unauthorized content follows catalog visibility rules.

## STAY-002 — valid availability search

For a seeded available range, the customer flow must return real inventory derived from the accepted staging database.

## STAY-003 — unavailable range fails closed

A range containing a missing/unavailable inventory date must not produce a confirmed booking.

## STAY-004 — DB-authoritative total

Attempt to manipulate client-submitted/displayed price must not change the authoritative booking total.

## STAY-005 — successful booking transaction

Expected atomic effect:

- exactly one booking row/effect;
- all required nightly inventory decremented once;
- initial booking history written;
- correct client identity derived server-side;
- no negative availability.

## STAY-006 — idempotent retry

Repeat the exact request under the same idempotency key.

Expected:

- same booking/effect returned;
- inventory not decremented twice;
- no duplicate booking history effect beyond designed idempotent behavior.

## STAY-007 — same key, changed payload conflict

Change dates/unit/meaningful payload under the same key.

Expected: fail closed with explicit replay/payload conflict; no second inventory effect.

## STAY-008 — last-room concurrency

Two real independent sessions request the final unit for overlapping dates.

Expected:

- exactly one succeeds;
- exactly one fails cleanly;
- availability never becomes negative;
- no orphan booking/history rows.

## STAY-009 — partner ownership visibility

partner_stay_a sees/manages only authorized stay inventory/bookings according to role policy.

## STAY-010 — admin read/control acceptance

admin_a can inspect the accepted operational booking state without bypassing required audit/business boundaries.

---

# 6. KÖL TOURS

## TOUR-001 — public discovery/detail

Active tour and detail route resolve from authoritative catalog data.

## TOUR-002 — real schedule availability

Available schedule exposes the correct remaining capacity/status.

## TOUR-003 — closed/insufficient capacity denial

Closed schedule or participant count above remaining capacity must fail without booking/capacity mutation.

## TOUR-004 — DB-authoritative total

Client cannot set authoritative tour total.

## TOUR-005 — successful booking

Expected atomic effect:

- booking created once;
- booked_count/capacity projection changed once;
- history created;
- server-derived client identity and total.

## TOUR-006 — idempotent replay

Exact retry under the same key does not increment capacity twice.

## TOUR-007 — changed participant payload conflict

Same key with changed participants fails closed.

## TOUR-008 — final-slot race

Two independent sessions race for the final slot.

Expected: capacity invariant is preserved; no overbooking.

## TOUR-009 — partner cross-tenant denial

Tour partner cannot mutate another partner's schedules/bookings.

---

# 7. KÖL SHOP

## SHOP-001 — public catalog/detail

Active shop/product data resolves through customer routes.

## SHOP-002 — normalized cart equivalence

Equivalent cart representations normalize to the same authoritative order meaning.

## SHOP-003 — DB-authoritative prices/totals

Client-supplied item price/subtotal/total must be ignored/rejected as authoritative input.

## SHOP-004 — successful order

Expected atomic effect:

- order created;
- order items persisted;
- authoritative subtotal/total stored;
- tracked stock decremented exactly once;
- history/audit written according to contract.

## SHOP-005 — out-of-stock denial

No order success and no negative stock.

## SHOP-006 — idempotent retry

Exact same-key replay returns the same order effect and does not decrement stock twice.

## SHOP-007 — changed cart replay conflict

Same key with changed product/quantity/business/type/delivery meaning fails closed.

## SHOP-008 — final-item concurrency

Two real sessions race for `stock_qty = 1`.

Expected:

- exactly one order succeeds;
- exactly one stock mutation occurs;
- no oversell;
- failed transaction leaves no partial order/item/history truth.

## SHOP-009 — partner ready-for-pickup transition

Authorized partner transition is atomic with required history/audit behavior.

## SHOP-010 — unauthorized partner denial

Another partner cannot operate the order.

---

# 8. KÖL FOOD

## FOOD-001 — public restaurant/menu

Active restaurant and menu resolve through customer routes.

## FOOD-002 — inactive item denial

Inactive/unavailable menu item cannot be successfully ordered.

## FOOD-003 — authoritative item prices

Client cannot set menu item monetary truth.

## FOOD-004 — minimum-order enforcement

If authoritative restaurant data defines a minimum, below-minimum order must fail without partial order effects.

## FOOD-005 — successful food order

Expected:

- order/items/history/audit atomically created according to the shared order contract;
- no invented ingredient-stock mutation;
- client identity and totals derived through trusted paths.

## FOOD-006 — idempotent retry

Exact replay creates one order effect.

## FOOD-007 — changed payload conflict

Same idempotency key with changed cart/meaning fails closed.

## FOOD-008 — partner acceptance / ready state

Only the owning active partner may perform the allowed operational transition.

## FOOD-009 — fulfillment path

The selected pickup/delivery mode must follow only supported authoritative rules. Unsupported delivery pricing/config must fail closed rather than invent a fee.

---

# 9. PAYMENT INTEGRITY

These scenarios begin only after an approved provider test adapter/signature verifier exists. Until then they may run provider-neutral at DB/integration level only.

## PAY-001 — attempt amount authority

Payment attempt amount equals the authoritative parent booking/order total.

## PAY-002 — paid event settlement

Valid verified paid event atomically settles payment and the parent projection according to contract.

## PAY-003 — exact event replay

Same provider/event/reference/type/status/amount/payload hash applies once.

## PAY-004 — replay conflict

Reuse same provider/event ID with changed payload hash/meaning.

Expected: fail closed; no second settlement.

## PAY-005 — amount mismatch

Provider paid amount different from internal amount must not settle the parent.

## PAY-006 — browser/session mutation denial

anon/authenticated clients cannot directly mutate payment truth.

## PAY-007 — refund event safety

Provider refund event may be recorded according to the staged contract, but automatic refund business action remains OFF until owner rules approve it.

## PAY-008 — raw payload/privacy boundary

Raw secret-bearing provider webhook payload is not persisted/exposed outside the approved sanitized boundary.

---

# 10. DELIVERY / COURIER

Canonical staged flow:

`courier_assigned → courier_accepted → courier_to_partner → arrived_at_partner → picked_up → courier_to_client → arrived_at_client → delivered`

## DEL-001 — dispatcher assignment

Authorized dispatcher/admin can assign an eligible online courier.

## DEL-002 — client dispatch denial

Client cannot assign courier or execute dispatcher-only operations.

## DEL-003 — other-courier denial

courier_b cannot progress courier_a's active delivery.

## DEL-004 — transition order enforcement

Courier cannot skip canonical states.

## DEL-005 — canonical successful lifecycle

Progress one delivery through all allowed states to `delivered`.

Expected:

- canonical history recorded;
- assignment consistency preserved;
- terminal active assignment removed;
- courier becomes available again;
- eligible order operational status synchronized where designed.

## DEL-006 — payment truth isolation

No delivery transition directly changes authoritative payment settlement state.

## DEL-007 — terminal replay idempotency

Repeat terminal same-status request; no duplicate damaging effect.

## DEL-008 — unsupported high-risk operations remain closed

Force-complete, late reassignment, payout, proof-of-delivery/GPS or failure flows must not become available merely because they are absent from the business contract.

---

# 11. CATALOG MEDIA / STORAGE

## MEDIA-001 — bucket contract

`catalog-media` is private and matches approved MIME/size policy.

## MEDIA-002 — partner upload ownership

Partner can upload only under an owned/authorized catalog object path.

## MEDIA-003 — cross-partner upload denial

Another partner's business/object path is denied.

## MEDIA-004 — metadata compensation

If metadata insert fails after object upload, compensation removes the orphan object according to source contract.

## MEDIA-005 — public signed read

Public catalog gets only intended short-lived signed object access for visible active catalog rows; bucket listing is not opened.

## MEDIA-006 — delete ownership

Partner cannot delete another partner's media.

---

# 12. CLIENT ACCOUNT

## CLIENT-001 — dashboard/profile

Authenticated client sees own profile/account state only.

## CLIENT-002 — booking history

Only own bookings are visible; detail route denies another client's booking ID.

## CLIENT-003 — order history

Only own orders are visible; detail route denies another client's order ID.

## CLIENT-004 — support

Support submission/read behavior respects ownership and data minimization.

## CLIENT-005 — favorites/reviews

If enabled in the accepted pilot, ownership and active-catalog constraints are enforced.

Loyalty/offers are non-blocking for core pilot unless explicitly promoted into scope.

---

# 13. PARTNER ACCOUNT

## PARTNER-001 — catalog ownership

Partner reads/mutates only own catalog rows.

## PARTNER-002 — availability ownership

Stay/tour availability/schedule operations are tenant-scoped.

## PARTNER-003 — booking/order operations

Partner can operate only allowed transitions on own business transactions.

## PARTNER-004 — STOP control

If STOP is enabled in the accepted product contract, it must fail closed for non-owning users and its effect on new transactions must be deterministic.

## PARTNER-005 — finance view

Finance UI must not grant authority to mutate payment truth directly.

## PARTNER-006 — media ownership

Matches MEDIA tests.

---

# 14. ADMIN ACCOUNT

## ADMIN-001 — admin-only access

Non-admin roles are denied admin routes/actions.

## ADMIN-002 — operational read truth

Bookings/orders/delivery/users/partners views reflect authoritative staged data, not unrelated mock truth.

## ADMIN-003 — moderation

Moderation operations require validated admin identity and preserve audit evidence.

## ADMIN-004 — finance boundary

Administrative finance views/actions do not bypass payment-integrity contracts.

## ADMIN-005 — auditability

Sensitive admin mutations generate the expected audit/history evidence.

---

# 15. FAILURE / ROLLBACK ACCEPTANCE

## FAIL-001 — migration stop-on-error

Any staged migration/VERIFY failure aborts the rehearsal; later layers are not blindly continued.

## FAIL-002 — app rollback

Documented source/deployment rollback is tested independently of DB restore.

## FAIL-003 — DB restore proof

Gate-1 backup can be restored to the approved isolated target and required baseline checks succeed.

## FAIL-004 — financial recovery boundary

After real provider settlements exist, never accept blind DB restore as the sole financial rollback mechanism; provider reconciliation/replay plan is required.

## FAIL-005 — Storage recovery boundary

DB backup is not accepted as proof that Storage object bytes are backed up/restorable.

---

# 16. Observability / evidence bundle

Each acceptance run must preserve a non-secret evidence bundle containing:

- Git commit SHA;
- test target identity;
- migration manifest/hash;
- restore/backup checksums;
- fixture version;
- scenario results by ID;
- failed assertion summaries;
- DB invariant summaries;
- role/cross-tenant negative-test results;
- concurrency result summaries;
- payment adapter mode;
- Storage contract result;
- timestamps;
- final GO / NO-GO conclusion.

Never include service-role secrets, DB passwords, provider secrets, raw webhook secrets or user passwords in the evidence bundle.

---

# 17. Pilot GO criteria

A controlled KÖL pilot may be proposed only when all release-critical scenarios for the chosen pilot scope pass against the approved target.

Minimum pilot-critical groups:

- AUTH-001..008;
- Stay tests if Stay is in pilot;
- Tour tests if Tours is in pilot;
- Food tests if Food is in pilot;
- Shop tests if Shop is in pilot;
- payment tests for every flow using real electronic payment;
- Partner tests for participating verticals;
- Delivery/Courier tests if delivery is enabled;
- MEDIA tests if partner media upload is enabled;
- FAIL-001..005;
- production secrets/environment and rollback acceptance;
- explicit owner production/pilot approval.

A module may be excluded from the first pilot, but it must be disabled/clearly unavailable rather than partially exposed as working.

---

# 18. Non-core deferral rule

The following must not block core transaction acceptance unless explicitly promoted into pilot scope:

- loyalty;
- advanced promotions;
- advanced analytics;
- AI concierge;
- complex recommendation ranking;
- autonomous marketing automation.

The priority remains:

**Stay / Tours / Food / Shop transactional truth → Partner operations → Admin operations → Courier/Delivery where enabled → payment/provider acceptance → controlled pilot.**

---

## Final acceptance principle

KÖL is accepted by evidence of real authoritative flows and denial boundaries, not by page count, mock UI completeness or optimistic status percentages.