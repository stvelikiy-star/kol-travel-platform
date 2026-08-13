# Internal Demo Flow QA Notes

Stage: 12H-2 - Internal Demo Flow QA Notes UI.

This stage adds small visible QA/demo notes to internal operational pages where demo buttons are already connected. The notes are UI copy only: they do not add business logic, do not connect backend, do not write to Supabase, and do not mutate mock data.

`ALCOHOL_MODULE_ENABLED=false` remains visible. Alcohol module is disabled.

## Pages Updated

Partner:

- `/partner/orders`;
- `/partner/stop`.

Courier:

- `/courier/active`;
- `/courier/issues`.

Admin:

- `/admin/delivery`;
- `/admin/ai-dispatcher`.

## Why Demo Notes Are Needed

The connected demo buttons are intentionally safe pilot interactions. The QA notes make this clear before broader wiring:

- button clicks show demo results only;
- no real data is changed;
- no payment status is changed;
- no Supabase write is performed;
- high-risk actions require admin approval and audit logging later;
- production actions must validate role, RLS and ownership before any write.

## No Real Writes

The notes reinforce that current demo flows:

- do not write to Supabase;
- do not mutate mock data;
- do not require environment variables;
- do not send notifications;
- do not process payments;
- do not connect Telegram or n8n.

## High-Risk Approval Later

High-risk operations will require admin approval later, including:

- accepted order cancellation;
- emergency partner stop;
- delivery issue force-close;
- force-complete request;
- courier reassignment after pickup;
- AI high-risk recommendation.

## Audit Log Later

Production versions must write audit logs for sensitive operations after auth, RLS, ownership checks, validation and approval workflows are implemented.

## AI Dispatcher Note

The AI dispatcher note states that AI can recommend, create alerts and log decisions, but cannot cancel orders, change payment status or enable alcohol module.

## Alcohol Module Disabled

- `ALCOHOL_MODULE_ENABLED=false`.
- Alcohol sales and delivery are disabled.
- AI cannot enable alcohol module.
- Partner, courier and admin demo actions cannot enable alcohol module.
- Any future alcohol activation requires legal review, licensing, partner verification and `super_admin` approval.
