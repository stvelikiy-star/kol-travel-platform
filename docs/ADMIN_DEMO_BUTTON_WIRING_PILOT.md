# Admin Demo Button Wiring Pilot

Stage: 12G-6 - Admin Demo Button Wiring Pilot.

This pilot connects a small set of admin and AI dispatcher buttons to safe demo action skeletons. It is demo-only wiring: no real backend is connected, no Supabase writes are used, mock data is not mutated, and no payments, Telegram or n8n flows are involved.

`ALCOHOL_MODULE_ENABLED=false` remains visible through `DemoActionResultPanel`. Alcohol module is disabled.

## Connected Admin Delivery Buttons

Page: `/admin/delivery`

The page now renders `AdminDeliveryDemoActions`, a small client component for demo interactions only.

Connected buttons:

- `Назначить курьера` -> `assignCourierDemoAction`;
- `Переназначить курьера` -> `reassignCourierAfterPickupDemoAction` as the current high-risk reassignment equivalent;
- `Отправить на проверку` -> local demo result `admin.mark_delivery_admin_review` because no persisted action file is created in this stage;
- `Закрыть проблему доставки` -> `forceCloseDeliveryIssueRequestDemoAction`;
- `Запросить force complete` -> `forceCompleteOrderRequestDemoAction`.

Placeholder IDs:

- `demo-order-1`;
- `demo-delivery-1`;
- `demo-courier-1`.

Placeholder reason:

- `Demo admin review`.

## Connected AI Dispatcher Buttons

Page: `/admin/ai-dispatcher`

The page now renders `AdminAiDispatcherDemoActions`, a small client component for AI dispatcher demo interactions only.

Connected buttons:

- `Рекомендовать курьера` -> `recommendCourierAssignmentDemoAction`;
- `Рекомендовать переназначение` -> `recommendCourierReassignmentDemoAction`;
- `Создать alert задержки` -> `createDelayAlertDemoAction`;
- `Создать лог решения AI` -> `createAiDecisionLogDemoAction`;
- `Создать safety refusal log` -> `createAiSafetyRefusalLogDemoAction`.

Placeholder IDs and strings:

- `demo-order-1`;
- `demo-ai-target-1`;
- `Demo AI recommendation`;
- `Demo safety refusal`.

## Result Panel Behavior

After a pilot button click, the page displays `DemoActionResultPanel` with:

- demo mode label;
- action message;
- action name;
- role;
- risk level;
- audit warning when `auditRequired=true`;
- human approval warning when `humanApprovalRequired=true`;
- alcohol safety line.

The panel must not claim that real data was changed.

## High-Risk Warning Behavior

High and critical demo actions show audit and/or human approval warnings through the result panel. This includes courier reassignment, force-closing delivery issues, force-complete requests and AI recommendations that require human admin review later.

No toast library or new dependency was added.

## Safety Rules

Admin demo actions are requests only. They do not:

- assign real couriers;
- reassign real couriers;
- close real delivery issues;
- force-complete real orders;
- change payment status;
- approve refunds;
- enable alcohol module.

AI dispatcher demo actions can recommend, alert and log only. AI cannot:

- execute high-risk actions;
- cancel orders;
- change payment status;
- approve refunds;
- block or unblock users;
- force-complete orders;
- enable alcohol module.

## Next Recommended Wiring Stages

Recommended next stages:

- align admin product-facing action aliases with exported skeleton names;
- connect a tiny moderation or finance pilot only after confirming high-risk warnings;
- add validation schemas for demo input payloads;
- keep all real writes blocked until auth, RLS, audit logs and approval workflows are ready.
