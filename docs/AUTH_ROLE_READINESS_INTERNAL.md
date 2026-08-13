# Auth Role Readiness Internal

Stage: 12I-3 - Auth Role Readiness.

This document defines future auth and role requirements for internal operations before demo actions become real backend actions. Auth is not connected in this stage, Supabase is not connected, no real backend writes are created, UI behavior is unchanged, and mock data is not mutated.

`ALCOHOL_MODULE_ENABLED=false` by default. Alcohol sales and delivery are disabled.

## Required Roles

Future internal backend wiring must support:

- `client`;
- `partner`;
- `courier`;
- `admin`;
- `super_admin`;
- `ai_dispatcher_system`.

## Role Rules

### Client

Client can later:

- create order;
- create booking;
- view own orders and bookings;
- request cancellation.

Client cannot:

- change payment status;
- access partner cabinet;
- access courier cabinet;
- access admin panel;
- view another client's private data.

### Partner

Partner can later:

- view only own business data;
- accept or reject own orders;
- mark own order preparing;
- mark own order ready_for_pickup;
- manage own catalog;
- manage own availability;
- pause future orders and bookings;
- report issue.

Partner cannot:

- access other partners;
- change payment status;
- force refund;
- cancel accepted order without admin;
- cancel after courier pickup without admin;
- enable alcohol module.

### Courier

Courier can later:

- view assigned or available deliveries according to rules;
- accept delivery;
- update physical delivery progress;
- report delivery issue;
- manage own shift and profile.

Courier cannot:

- change payment status;
- change order items;
- cancel order;
- access partner private data;
- access admin data;
- enable alcohol module.

### Admin

Admin can later:

- view operational dashboards;
- review issues;
- assign and reassign couriers;
- moderate partners and catalog;
- review finance issues;
- approve high-risk actions according to permissions.

Admin rules:

- high-risk actions require audit log;
- high-risk actions require reason;
- admin cannot bypass legal or compliance requirements;
- admin cannot enable alcohol module without `super_admin` and legal flow.

### Super Admin

Super admin can later:

- manage platform-level settings;
- approve critical compliance flows;
- manage admin roles.

Super admin rules:

- alcohol activation still requires legal review, licensing and partner verification;
- AI cannot replace `super_admin` approval;
- critical compliance actions must be audited.

### AI Dispatcher System

AI dispatcher system can later:

- create recommendations;
- create alerts;
- create decision logs;
- classify issue severity;
- draft messages.

AI dispatcher system cannot:

- execute high-risk actions;
- cancel orders;
- change payment status;
- approve refunds;
- block or unblock users;
- force-complete orders;
- enable alcohol module.

## Auth Readiness Checklist

Before real backend wiring:

- Supabase Auth project ready;
- user profiles table ready;
- roles table or role enum ready;
- partner ownership relation ready;
- courier assignment relation ready;
- admin permissions ready;
- RLS policies reviewed;
- server action role checks planned;
- ownership checks planned;
- audit log planned;
- high-risk approval flow planned;
- session handling planned;
- protected route strategy planned;
- rollback to mock mode verified.

## Protected Route Plan

Future protected routes:

- `/client/**` requires `client` or `admin`;
- `/partner/**` requires `partner` or `admin`;
- `/courier/**` requires `courier` or `admin`;
- `/admin/**` requires `admin` or `super_admin`;
- AI dispatcher internal writes must be server-only.

Demo pages are currently not protected. Protection must be added only after auth/session strategy is ready.

## Ownership Checks

### Partner

Partner server actions must verify:

- `partner_id` matches authenticated partner;
- catalog item belongs to partner;
- order belongs to partner;
- booking belongs to partner;
- availability record belongs to partner;
- stop scope belongs to partner.

### Courier

Courier server actions must verify:

- delivery is assigned to courier or available according to assignment rules;
- active delivery belongs to courier after acceptance;
- courier shift/status allows action;
- courier cannot update payment, order items or partner preparation status.

### Admin

Admin server actions must verify:

- admin role and permission;
- high-risk action approval status;
- reason is provided;
- target record exists;
- audit log is written;
- before/after state is captured later.

## Internal Action Readiness

### Partner Actions

Partner order actions require:

- role: `partner`;
- ownership: order belongs to partner;
- allowed transitions: new -> accepted/rejected, accepted -> preparing, preparing -> ready_for_pickup;
- audit: yes for issue/cancellation/high-risk actions;
- human approval: yes for accepted cancellation and post-pickup cancellation.

Partner stop/catalog/availability actions require:

- role: `partner`;
- ownership: scope belongs to partner;
- target tables: partner stop settings, catalog tables, availability tables;
- audit: yes for broad stop/category stop/conflict;
- human approval: yes for emergency stop and high-risk scope changes.

### Courier Actions

Courier delivery progress actions require:

- role: `courier`;
- assignment: delivery assigned or available by rules;
- target tables: `deliveries`, `delivery_status_history`;
- allowed transitions: courier_assigned -> courier_to_partner -> picked_up -> courier_to_client -> delivered;
- audit: yes for issue/high-risk changes;
- human approval: yes for critical issue/escalation.

Courier issue/profile actions require:

- role: `courier`;
- ownership: own profile or own/assigned delivery;
- target tables: `delivery_issues`, `courier_profiles`, `courier_shifts`;
- audit: yes for issue reports and profile problems;
- human approval: yes for critical incidents.

### Admin Actions

Admin delivery, moderation, finance and user actions require:

- role: `admin` or `super_admin` depending on risk;
- high-risk approval for sensitive changes;
- audit log for all sensitive actions;
- target tables: deliveries, courier assignments, issues, partners, catalog, finance, users, roles;
- safety restriction: no payment/refund/cancellation/force-complete without strict approval and audit.

### AI Dispatcher Actions

AI dispatcher backend wiring must be limited to:

- `ai_recommendations`;
- `ai_alerts`;
- `ai_decision_logs`;
- severity classification records.

AI cannot execute real high-risk changes.

## Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`.
- Alcohol sales and delivery are disabled.
- AI cannot enable alcohol module.
- Partner, courier and admin cannot enable alcohol through demo actions.
- Super admin cannot activate alcohol without legal review, licensing and partner verification.
- Alcohol-related request is critical risk.
- Any future alcohol activation requires audit log and compliance review.

## Next Readiness Step

Recommended next stage: Stage 12I-4 - Real Backend Wiring Plan.
