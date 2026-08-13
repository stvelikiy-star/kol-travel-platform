# Internal Demo Actions Final Audit

Stage: 12F-6 — Internal Demo Actions Final Audit.

This document records the final audit of internal demo actions for partner, courier, admin and AI dispatcher flows. These actions are skeletons only. They are not connected to UI, do not write to Supabase, do not mutate mock data, do not require environment variables, and do not call payments, Telegram or n8n.

`ALCOHOL_MODULE_ENABLED=false` by default. Alcohol sales and delivery are disabled.

## Audit Result

Internal demo action skeletons are present for:

- shared action result helper;
- partner operations;
- courier operations;
- admin operations;
- AI dispatcher recommendations, alerts and decision logs.

During this final audit, admin action files were missing from `src/app/actions/admin/**`. The gap was fixed by adding safe admin demo request skeletons for delivery, finance, moderation, settings and users.

## Shared Result Format

Shared helper:

- `createDemoActionResult`;
- `DemoActionResult`.

Result fields:

- `ok`;
- `mode: "demo"`;
- `action`;
- `message`;
- `role`;
- `riskLevel`;
- `humanApprovalRequired`;
- `auditRequired`;
- `alcoholModuleEnabled: false`.

The shared helper now supports the internal action metadata fields `role` and `riskLevel`. They remain optional for backwards compatibility with earlier client demo actions, but internal partner/courier/admin/AI actions provide them.

Allowed roles:

- `client`;
- `partner`;
- `courier`;
- `admin`;
- `ai_dispatcher`.

Allowed risk levels:

- `low`;
- `medium`;
- `high`;
- `critical`.

## Partner Demo Actions

Partner action groups:

- `partnerOrders.ts`;
- `partnerBookings.ts`;
- `partnerStop.ts`;
- `partnerCatalog.ts`;
- `partnerAvailability.ts`.

Partner actions:

- do not mutate mock data;
- do not call Supabase;
- do not require environment variables;
- do not change payment status;
- do not force refunds;
- do not cancel accepted orders directly;
- do not enable alcohol module.

High-risk partner requests require `humanApprovalRequired: true` and `auditRequired: true`, including accepted order cancellation and confirmed booking cancellation.

## Courier Demo Actions

Courier action groups:

- `courierDeliveries.ts`;
- `courierIssues.ts`;
- `courierProfile.ts`.

Courier actions:

- do not mutate mock data;
- do not call Supabase;
- do not require environment variables;
- do not change payment status;
- do not change order items;
- do not cancel orders directly;
- do not enable alcohol module.

High and critical courier issue actions require audit, and critical emergency actions require human approval.

## Admin Demo Actions

Admin action groups:

- `adminDelivery.ts`;
- `adminFinance.ts`;
- `adminModeration.ts`;
- `adminSettings.ts`;
- `adminUsers.ts`.

Admin actions are demo requests only. They:

- do not mutate mock data;
- do not call Supabase;
- do not require environment variables;
- treat payment changes as demo requests only;
- treat refunds as demo requests only;
- require audit for sensitive actions;
- require human approval for high-risk and critical actions.

Critical admin actions include payment status changes, refund approval requests and alcohol compliance review requests.

## AI Dispatcher Demo Actions

AI dispatcher action groups:

- `aiRecommendations.ts`;
- `aiAlerts.ts`;
- `aiDecisionLogs.ts`.

AI dispatcher actions:

- only recommend, alert or log;
- do not execute real actions;
- do not cancel orders;
- do not change payment status;
- do not approve refunds;
- do not block or unblock users;
- do not force-complete orders;
- do not enable alcohol module.

High-risk AI recommendations require human approval later. Safety refusal logs are audit-required because AI must log when refusing high-risk actions.

## Audit Requirements Later

Future real backend actions must add:

- auth validation;
- role validation;
- ownership/RLS checks;
- input validation;
- human approval workflow for high-risk actions;
- audit log writes;
- before/after state capture;
- notification routing;
- safe error handling.

Audit is required later for:

- accepted order cancellation;
- confirmed booking cancellation;
- cancellation after courier pickup;
- payment status changes;
- refund approval;
- delivery status override;
- courier reassignment after pickup;
- partner/courier/user blocking;
- platform settings changes;
- high-risk AI approval;
- alcohol compliance review.

## No Real Backend Writes

Current demo actions:

- do not write to Supabase;
- do not use service role keys;
- do not require environment variables;
- do not mutate mock arrays;
- do not connect to UI submit handlers;
- do not send notifications;
- do not process payments.

## Alcohol Module Disabled

- `ALCOHOL_MODULE_ENABLED=false`.
- Alcohol sales and delivery are disabled.
- AI cannot enable alcohol module.
- Partner/courier/admin demo actions cannot enable alcohol module.
- Any future alcohol activation requires legal review, licensing, partner verification and `super_admin` approval.
- Any alcohol-related request is critical risk.

## Next Stage Recommendation

Stage 12G should connect demo action semantics to documentation or UI labels only, or prepare validation schemas, while still avoiding real backend writes until auth, RLS, audit logs and approval flows are ready.
