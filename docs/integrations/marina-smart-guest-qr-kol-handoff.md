# MARINA SMART → KÖL: QR guest offers integration (design contract, not deployed)

Date: 2026-10-22. Owner: AI PROF KG. Status: integration proposal — NO runtime changes.

## User journey
1. Guest scans the hotel's room QR and enters the **existing** MARINA SMART guest portal.
2. The first section displays hotel-owned services (requests, room service, cleaning, review, in-stay details), all fulfilled by MARINA SMART.
3. The second section displays a curated **KÖL offers** preview (tours, transfers, food, shops). Selecting an offer opens KÖL on the existing public catalog or offer page.
4. KÖL order/booking remains wholly in KÖL. Optional status is returned to MARINA SMART via an authenticated event integration.

## Data boundaries
- Hotel has a stable externally mapped `hotel_partner_id`; KÖL maintains a separate mapping of participating hotels to its own referral partner IDs.
- **Never** put a guest name, phone, stay ID, room number, personal token or long-lived credential into the QR or KÖL link.
- Static room QR identifies a *hotel entry point*, not a logged-in guest; MARINA SMART must authenticate the guest before displaying personal booking/stay details.
- Guest portal never shares MARINA SMART sessions, database credentials or table access with KÖL.
- No shared database; minimum server-to-server API with per-property isolation.
- KÖL must reject arbitrary user-supplied partner attribution: hotel referral values require server-side authorization/signature and expiration.

## Proposed contracts (to implement after current code review)
**A. Offer discovery**: MARINA SMART backend obtains public KÖL offers, passing an allowlisted location/region and explicit offer categories. Read-only; cache 1-5 minutes, graceful fallback if KÖL is unavailable. A partner config determines whether the hotel displays tours, transfers, food, shopping.
**B. Referral handoff**: MARINA SMART backend requests a short-lived, signed, one-time handoff code tied to a verified hotel partner and optional consented delivery location (not room number). Guest opens KÖL with the code; KÖL redeems it server-side, writes an immutable attribution record and directs to the selected offer.
**C. Order status**: KÖL sends signed, idempotent server-to-server events `order.created`, `order.status_changed`, `order.completed`, `order.cancelled`. MARINA SMART validates signature, property mapping, event ID replay, and scoped permissions.
**D. Analytics**: attributed visits, orders, completed order value and commission reports are kept in KÖL. Commission rate only from explicit partner agreement; never infer or auto-charge.

## Security acceptance gates
1. QR replay without guest authentication NEVER leaks name, stay, room or order history.
2. Cross-hotel referral token reuse or changing hotel ID is rejected.
3. Expired, forged and already-redeemed handoff codes fail closed.
4. Customer may browse offers without KÖL account; KÖL signup/login happens only at necessary checkout step.
5. Hotel's own services continue to work when KÖL is unavailable.
6. KÖL order cannot alter a MARINA SMART booking or guest profile.
7. Webhook signature, per-hotel scoping, retry and duplicate-event behavior are covered by tests.
8. RU/KG/EN interface copy is localized by the owning platform.

## Launch sequencing
**Phase 0:** settle KÖL launch P0 issues: booking RPC parity (#150), direct INSERT (#151), concurrency (#148). Do not enable real reservations/payments until resolved.
**Phase 1:** existing MARINA SMART guest portal gets a static KÖL offers tile and safe link to public KÖL landing/catalog. No guest context or attribution; can be piloted after owners approve UI change.
**Phase 2:** verified partner mapping, short-lived referral handoff and analytics; isolated test identities only.
**Phase 3:** optional signed status events and commission reporting with contract and real end-to-end test.

## Exclusions
- No modifications to MARINA SMART or its database in this commit.
- No KÖL site design change, no Supabase migration or production deploy.
- No automatic KÖL auth creation solely by scanning a room QR.

Blocking dependency: obtain access to the actual MARINA SMART guest portal repository and its QR access implementation for targeted UI/API changes. 
