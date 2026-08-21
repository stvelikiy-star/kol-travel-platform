# KÖL — MASTER PROJECT CONTEXT V6

**Date:** 2026-08-21  
**Project:** KÖL / KOL Travel / `kol-travel-platform`  
**Scope:** KÖL only. Never mix with PALADIN, AK BERMET, cottage.kg or any other project.  
**Status:** EXISTING PRODUCT / SOURCE RECOVERED / CORE SOURCE + LOCAL STAGING SUBSTANTIALLY PROVEN / LIVE MIGRATIONS + PAYMENTS + PRODUCTION NOT AUTHORIZED

---

## 0. Executive truth

KÖL is not a landing page and not a new project to rebuild from zero. It is an Issyk-Kul marketplace / super-app ecosystem intended to cover the main customer journey around a trip and stay at Issyk-Kul through one account and one transactional core.

Historical four core domains:

1. **KÖL Stay** — accommodation.
2. **KÖL Tours** — tours and activities.
3. **KÖL Food** — food ordering / delivery.
4. **KÖL Shop** — local marketplace / goods.

Operational surfaces:

- Guest / public catalog.
- Client account.
- Partner portal.
- Courier surface when delivery is used.
- Admin / operations.

Primary product principle:

**ONE ECOSYSTEM / ONE ACCOUNT / ONE TRANSACTIONAL CORE.**

Supabase/PostgreSQL is the authoritative source for sensitive business truth: roles, ownership, price, stock, availability, booking/order/payment/delivery state and other protected mutations.

AI may help the user search, compare and assemble a journey, but it must never invent price, availability, stock, booking confirmation, payment/refund status or fees.

---

## 1. Product positioning

Working brand: **KÖL** (Köl / Көл — lake).  
Historical descriptor: **Travel & Delivery**.  
Recovered positioning: **“Весь Иссык-Куль в одном приложении”**.

KÖL is designed to solve fragmentation of the Issyk-Kul visitor experience:

- accommodation is searched in one place;
- tours in another;
- food is ordered by phone/chat;
- products and local services are scattered;
- prices and availability are frequently not synchronized;
- partners often lack lightweight CRM / operational tooling.

KÖL’s value is not just aggregation. The differentiator is the integration of discovery + availability + transaction + partner operations inside one product.

---

## 2. Target users

### 2.1 Tourist / guest

Target groups include:

- domestic travellers from Bishkek and other Kyrgyzstan regions;
- visitors from Kazakhstan and Russia;
- international visitors;
- local residents of the resort zone for food/goods flows.

Desired journey:

`plan trip → find stay → book activity → order food → buy needed goods → manage everything from one account`

### 2.2 Partner

Partner types:

- hotels;
- guest houses;
- resorts / recreation bases;
- restaurants / cafes;
- stores;
- tour operators;
- guides;
- delivery operators where applicable.

Partner value:

- orders and bookings;
- catalog/menu/product/room/tour management;
- availability/calendar control;
- stop button / stop lists;
- customer/order/booking CRM surface;
- status management;
- finance and analytics later where business rules are approved.

### 2.3 Courier

Minimal operational contour:

`assigned → accepted → to partner → arrived at partner → picked up → to client → arrived at client → delivered`

Courier must only see and mutate what is required for the assigned delivery.

### 2.4 Admin / operator

Admin is responsible for:

- partner onboarding and moderation;
- content moderation;
- support/disputes;
- commission configuration once business rules are approved;
- operational control;
- financial reconciliation once payments exist;
- security/audit-sensitive actions.

Critical actions must be auditable.

---

## 3. Core product flows — definition of real value

### Stay

`search → real availability → booking → approved payment flow → confirmation`

### Tours

`search → real schedule/slot → booking → approved payment flow → confirmation`

### Food

`menu → cart → order → partner acceptance/preparation → fulfillment/delivery → completion`

### Shop

`catalog → cart → authoritative stock check → order → fulfillment/pickup/delivery → completion`

A module is not “done” merely because a page exists. It is done only when the corresponding E2E transaction works against authoritative data with correct RBAC, idempotency and concurrency behavior.

---

## 4. Business model / monetization direction

Recovered monetization mechanisms include:

- commission on completed food/shop orders;
- commission or fixed fee on accommodation bookings;
- tour transaction commission;
- partner subscriptions / CRM tooling tiers;
- premium placement / promoted listings;
- paid promotions / campaigns;
- delivery economics where KÖL operates or coordinates delivery.

**Important:** exact commission rates, subscription prices, service fees, delivery fees and payout rules are NOT currently approved source-of-truth business values. Do not invent them in code or UI.

Recommended economic principle for pilot:

- low-friction partner onboarding;
- commission primarily on successful transaction;
- do not burden the pilot with multiple monetization layers simultaneously;
- prove repeatable supply, conversion and operational reliability first.

---

## 5. Scope discipline

Historical core priority:

1. Tours.
2. Accommodation.
3. Food Delivery.
4. Shop.
5. Shared transaction/payment/identity/authorization foundation.
6. Partner/Admin/Courier operational surfaces.

Do **not** prioritize before the core is stable:

- AI concierge;
- complex loyalty mechanics;
- heavy analytics;
- advertising platform;
- large automation layer;
- nonessential gamification.

AI comes after authoritative live core.

---

## 6. Search, maps, reviews and notifications

### Search

Target dimensions include location, date, category, price, rating, availability, guests, distance, open-now and delivery/activity filters.

### Maps

Maps are strategically important for Issyk-Kul because users need to discover stays, restaurants, shops, activities, attractions and pickup/service points geographically.

No map provider is currently approved as final. Do not hard-code a business dependency on Google Maps, 2GIS, Mapbox or another provider until selection is made.

### Reviews

Preferred rule:

- real customer;
- linked to real completed booking/order;
- linked to correct partner/item/property;
- moderation status.

### Notifications

Target event layer includes booking/order/payment/delivery/support events. Channel selection (in-app, push, WhatsApp, SMS, email, Telegram operational alerts) remains an integration decision, not an assumed historical fact.

---

## 7. Technology — current source of truth

Repository:

`stvelikiy-star/kol-travel-platform`

Recovery baseline:

`7e713b19f6c73c329c09df1163afba17c5443096`

Current `main` while this document is created:

`1cb37e622ae2818debc514f6a372747a3dc2a132`

Current framework baseline:

- Next.js 16.3.1
- React / React DOM 19.2.x
- TypeScript 5.7.x
- Node >=22
- Tailwind CSS 3.4.x
- ESLint 9 flat config
- `@supabase/ssr` 0.12.4
- `@supabase/supabase-js` 2.111.0

Original source was recovered from:

`/home/agent/Загрузки/kol-travel-platform`

Historical Windows path had been:

`C:\Users\ASUS\Documents\kol-travel-platform`

The old `.git` history was not recoverable, so current GitHub history begins from the recovery baseline and must not pretend to contain the original history.

---

## 8. Supabase — current verified live baseline

Project:

- name: `kol-travel-platform-test`
- ref: `mphruawzozrpwcjgejhs`
- region: Seoul / `ap-northeast-2`
- PostgreSQL 17
- last verified health: `ACTIVE_HEALTHY`

Read-only baseline verified 2026-08-20:

- 54 public base tables;
- 54/54 RLS enabled;
- 46 public policies;
- 26 RLS-enabled tables with zero policies;
- 6 public helper/trigger functions needing fixed search-path hardening in the live baseline;
- 99 public indexes;
- 80 checked single-column public foreign keys;
- 49 missing valid leading indexes in the live baseline;
- 4 recovery/demo Auth users;
- 0 payment rows;
- 0 Storage buckets;
- 0 Storage objects;
- Supabase migration ledger absent;
- 0 Supabase development branches at last check.

Critical rule:

**Git SQL files are not automatically the historical live migration ledger.**

A real logical backup/schema baseline is required before any live migration apply.

---

## 9. Source/local-staging work already completed

Merged to `main` by 2026-08-20:

- source CI bootstrap and runtime modernization;
- Next.js 16.3.1 / React 19 security/framework upgrade;
- RLS/security baseline source restack;
- FK index baseline source restack;
- Stay/Tour transaction source layer;
- Food/Shop transaction source layer;
- private catalog-media Storage design;
- payment integrity core;
- delivery lifecycle core;
- release/staging readiness and fail-closed production guard;
- machine-checked staging execution package;
- local Supabase staging smoke foundation.

The disposable local Supabase proof demonstrates that the migration sequence can reach a hardened target without changing live infrastructure.

---

## 10. Current high-confidence draft proof

### PR #39 — transaction and concurrency proof

Proved on disposable local Supabase:

- 21/21 migration layers;
- Stay idempotency + DB-authoritative pricing + last-room race protection;
- Tour idempotency + capacity correctness;
- Shop cart normalization + DB-authoritative price/stock + last-item race protection;
- provider-neutral payment idempotency, replay-conflict protection and amount mismatch rejection;
- automatic refund remains OFF;
- delivery role/state-machine behavior;
- target structural invariants: RLS policies, protected direct writes, fixed helper search paths, private media bucket and FK index coverage.

### PR #40

Dependency hardening: root dev `brace-expansion` HIGH issue fixed; production and full dependency graph audits prove 0 vulnerabilities on the tested head.

### PR #41

Next internal-link lint rule restored and 17 internal anchors migrated to `next/link`; full stacked CI PASS.

### PR #42

Technical Master Context V5, docs-only.

### PR #43

Live backup/baseline + staging rehearsal runbook, docs-only.

### PR #44

Pure read-only SQL evidence pack for live baseline capture.

### PR #45

Draft pre-live Gate 1 integration candidate assembling the proven source-only layers on top of current main. It is explicitly **not** authorization to merge or touch live infrastructure.

---

## 11. Payments and finance

The technical payment core is intentionally provider-neutral.

Locally proven technical properties:

- authoritative parent amount;
- attempt idempotency;
- provider-event idempotency;
- conflict on reused event identity with changed payload;
- amount mismatch rejection;
- atomic parent settlement projection;
- refund event record possible;
- automatic refunds OFF.

Still owner/business decisions:

- payment provider;
- service/commission fee model;
- cancellation windows;
- refund rules;
- no-show rules;
- partner payout schedule/rules;
- delivery fee model.

No real payment has been charged or refunded by the current KÖL recovery work.

---

## 12. Storage / media

Live Supabase currently had no bucket/object at last verified baseline.

Target design uses private `catalog-media` storage with controlled partner access and signed public read URLs.

Current staging contract:

- private bucket;
- JPEG/PNG/WebP/AVIF;
- SVG excluded;
- bounded file size;
- path ownership tied to authoritative partner/catalog business data;
- partner upload/delete runs through authenticated RLS boundaries rather than browser service-role bypass.

DB backup and Storage object backup are separate recovery domains.

---

## 13. Deployment / infrastructure

At last check:

- no established KÖL Vercel production project;
- no established KÖL Vercel staging project;
- no accepted production domain state;
- no accepted production environment/secrets.

Source guard is fail-closed: production must not run in mock mode, expose service-role secrets publicly or enable the alcohol module.

Alcohol module remains OFF by default until separate legal approval.

---

## 14. Owner gates — only places where owner involvement is required

### Gate 1 — authoritative DB backup + migration baseline

Before live SQL:

- logical DB dump;
- schema dump;
- checksums;
- read-only baseline capture;
- restore test in approved isolated target;
- accepted rollback/recovery rules;
- frozen migration order/hashes.

### Gate 2 — Auth leaked-password protection

Enable/approve before production Auth acceptance.

### Gate 3 — payment/business policy

Approve provider, fees, cancellation/refund/no-show, partner payout and delivery-fee policy.

### Gate 4 — production secrets/environment

Provide/configure via secret systems only.

### Gate 5 — production release

Explicit approval before live migration, real payments or production deployment.

All other safe source/test/documentation work should continue autonomously.

---

## 15. Strategic product plan

### Phase A — Source consolidation

Goal: one indisputable source state.

- finish integration review of PR #45;
- resolve source-only draft stack cleanly;
- keep CI green;
- keep `main` deterministic;
- keep one current Master Context.

### Phase B — Gate 1 / real staging readiness

- capture real live read-only baseline;
- execute authorized logical backup;
- restore into approved isolated staging;
- apply frozen migration sequence;
- run RBAC, E2E, concurrency, idempotency, payment and delivery tests.

### Phase C — Core completion

Prioritize only customer value gaps in:

- Stay;
- Tours;
- Food;
- Shop;
- shared checkout/payment/identity;
- Partner/Admin/Courier operational paths.

### Phase D — Pilot

Recommended launch discipline:

- geographically dense pilot rather than the entire lake at once;
- small number of reliable supply partners per vertical;
- manually verified catalog and availability quality;
- measurable support and fulfillment SLA;
- controlled real transactions;
- daily reconciliation of bookings/orders/payments;
- collect conversion, cancellation, support and repeat-rate data.

### Phase E — Scale

Only after pilot proof:

- expand partner coverage and geography;
- add loyalty/promos where unit economics support them;
- strengthen maps/search/recommendations;
- introduce AI Concierge on top of real APIs;
- add more automation and AI PROF operational control.

---

## 16. Go-to-market direction

KÖL should not compete as “one more hotel site”. Its strongest market story is:

**one local operating layer for the whole Issyk-Kul journey.**

Partner acquisition message:

- new demand channel;
- lightweight digital CRM/operations;
- stop-button and availability control;
- less chaos from Instagram/WhatsApp/manual calls;
- no need to build separate booking/order software.

Customer acquisition message:

- one account;
- verified local supply;
- real availability;
- one history/support layer;
- local expertise across stay + activities + on-location services.

Pilot success must be measured by real conversion and operational reliability, not by catalog size or number of pages.

---

## 17. 2026 market reality to design against

The Kyrgyz digital travel market is no longer empty. Dedicated products already exist for individual verticals such as accommodation and tours, and major delivery infrastructure is present in Kyrgyzstan.

Therefore KÖL’s defensible advantage cannot be “we also list hotels” or “we also list tours”.

The product moat must come from:

1. Issyk-Kul depth and local supply quality.
2. Cross-vertical journey integration.
3. Real operational partner tooling.
4. Reliable availability/stock/state truth.
5. Transaction and support quality.
6. Local data and repeat customer relationship.

---

## 18. Hard no-go rules

Never:

- mix KÖL context with another project;
- rebuild KÖL from scratch while recovered source exists;
- apply live SQL without explicit authorization + backup/baseline;
- mutate live Auth/Storage just to pass tests;
- create paid infrastructure without cost approval;
- enable real payments without approved provider/business rules;
- deploy production without explicit approval;
- invent commission, fee, refund, cancellation or payout values;
- let AI become transaction authority;
- expose service-role secrets to browser/public env;
- claim draft/local results are already live;
- silently merge draft PRs.

---

## 19. Source-of-truth policy

When sources conflict, priority is:

1. latest explicit owner decision;
2. current GitHub `main`;
3. current verified live/staging infrastructure;
4. current Supabase schema/data;
5. fresh CI/audit/test evidence;
6. latest KÖL Master Context;
7. older recovery documents/plans.

Historical documents are useful for intent but never override verified current state.

---

## 20. Immediate autonomous next actions

Without owner interruption:

1. keep PR #45 under source-only review and fix any failing CI/proof gaps;
2. keep Master Context synchronized with accepted source state;
3. audit UI/product routes against the four core E2E definitions;
4. generate a real implementation matrix from current source, not old plans;
5. isolate remaining missing product behavior from infrastructure work;
6. prepare staging acceptance test packs;
7. prepare pilot partner onboarding/data quality workflow;
8. prepare analytics events/KPI schema for pilot measurement;
9. keep alcohol, automatic refunds, live payments and production OFF until owner gates are closed.

The next major milestone is not “more pages”. It is:

**KÖL PRE-LIVE GATE 1 → CONTROLLED STAGING → CORE E2E ACCEPTANCE → PILOT.**
