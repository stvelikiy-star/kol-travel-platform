# BACKEND INTEGRATION ROADMAP

## Назначение

Документ описывает практический roadmap подключения backend, database, auth, deliveries, AI dispatcher, notifications and payments later. На Stage 11A ничего не подключается: это planning only.

## Compliance note

Alcohol module remains OFF by default. No alcohol delivery or sales are enabled. Activation requires legal review, licensing, partner verification and admin approval. `ALCOHOL_MODULE_ENABLED=false`.

## Phase 1 — Backend foundation

Goal: выбрать и подготовить backend foundation без изменения пользовательских flow.

Recommended choice:
- Supabase / PostgreSQL;
- Supabase Auth или Auth.js поверх Supabase;
- Supabase Storage или Cloudinary для медиа later.

Tasks:
- create Supabase project;
- define environment variables;
- create database schema;
- create enum/status values;
- create auth users and roles model;
- create RLS helper functions;
- create audit log table;
- keep integrations disabled.

Environment variables:
- `NEXT_PUBLIC_SUPABASE_URL`;
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`;
- `SUPABASE_SERVICE_ROLE_KEY`;
- `DATABASE_URL`;
- `ALCOHOL_MODULE_ENABLED=false`;
- `PAYMENTS_ENABLED=false`;
- `TELEGRAM_ENABLE_REAL_CALLS=false`;
- `N8N_ENABLE_REAL_CALLS=false`.

Result:
- backend foundation ready;
- no real payments;
- no real Telegram/n8n;
- alcohol module locked OFF.

## Phase 2 — Seed data and public catalog

Goal: заменить mock data на seed/database data постепенно.

Tasks:
- migrate mock partners to seed `partners`;
- migrate mock tours/stays/food/products;
- add categories and media placeholders;
- connect public catalog pages to database reads;
- connect public detail pages;
- keep checkout/booking as demo until validation endpoints are ready.

Rules:
- public reads only approved/active catalog;
- alcohol products are not seeded for public display;
- stopped/hidden items are not visible in public catalog.

Result:
- public site reads real database data;
- no client auth required for browsing.

## Phase 3 — Client and partner cabinets

Goal: подключить real auth and scoped cabinets.

Tasks:
- connect client profile;
- connect client orders/bookings/favorites/loyalty;
- connect partner business profile;
- connect partner catalog management;
- connect partner orders/bookings CRM;
- connect stop-button records through `PartnerStopStatus`;
- connect availability for rooms/tours.

Rules:
- client sees only own data;
- partner sees only own business data;
- stop button blocks only new orders/bookings or selected scope;
- stop button does not cancel accepted orders/bookings.

Result:
- client and partner cabinets become real scoped dashboards.

## Phase 4 — Orders, bookings, delivery and admin control

Goal: connect core operational flows.

Tasks:
- implement cart validation;
- implement checkout validation;
- create orders and order items;
- create booking flow with availability lock/check;
- create delivery records after partner ready-for-pickup;
- connect courier assignments and courier cabinet;
- connect admin orders/bookings/delivery control.

Delivery rules:
- partner controls preparation only;
- courier controls physical delivery only;
- admin resolves disputes and high-risk issues;
- delivery status history is required.

Booking rules:
- `room_availability` is source of truth;
- `tour_schedules` is source of truth;
- no overbooking;
- closed dates block only new bookings.

Result:
- real order/booking/delivery workflow with audit logs.

## Phase 5 — AI dispatcher, notifications and integrations

Goal: add controlled automation after operations are auditable.

Tasks:
- connect AI dispatcher event ingestion;
- create AI recommendations and alerts;
- connect admin approval workflow;
- connect notifications table;
- connect Telegram later;
- connect n8n later.

AI safety:
- AI never invents facts;
- AI never changes payment status;
- AI never cancels orders without admin approval;
- AI never promises delivery time without data;
- AI never enables alcohol delivery.

Result:
- AI dispatcher assists operations but does not bypass human approval.

## Phase 6 — Payments later

Goal: add online payments only after legal/payment setup.

Tasks:
- choose payment provider;
- confirm legal entity and settlement process;
- map payment statuses;
- implement webhook handling;
- implement refunds with audit;
- implement payout reporting.

MVP before this:
- manual;
- cash;
- transfer;
- COD where appropriate.

Result:
- online payments added safely after finance controls.

## Phase 7 — Production security and deployment

Goal: production readiness.

Tasks:
- RLS audit;
- penetration/security review;
- backup policy;
- monitoring;
- logging;
- error tracking;
- rate limiting;
- deployment checklist;
- incident response plan.

Required checks:
- no service role key in client;
- no public write policies;
- all dangerous actions audited;
- finance access restricted;
- admin approvals enforced;
- alcohol module remains OFF unless compliance approval is complete.

Result:
- production build and operations baseline.
