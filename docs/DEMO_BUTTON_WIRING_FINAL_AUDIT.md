# Demo Button Wiring Final Audit

Stage: 12G-7 - Demo Button Wiring Final Audit.

This document records the final audit of demo button wiring across partner, courier, admin and AI dispatcher pilot pages. The wiring remains demo-only: no real backend is connected, no Supabase writes are used, mock data is not mutated, no environment variables are required, and payments, Telegram and n8n are not involved.

`ALCOHOL_MODULE_ENABLED=false` remains visible in `DemoActionResultPanel`. Alcohol module is disabled.

## Audit Result

Audited pilot pages:

- `/partner/orders`;
- `/partner/stop`;
- `/courier/active`;
- `/courier/issues`;
- `/admin/delivery`;
- `/admin/ai-dispatcher`.

During this final audit, partner pilot wiring was missing from `/partner/orders` and `/partner/stop`. The gap was fixed by adding small client components inside the allowed partner route folders:

- `src/app/partner/orders/PartnerOrdersDemoActions.tsx`;
- `src/app/partner/stop/PartnerStopDemoActions.tsx`.

Courier and admin pilot wiring was already present and was checked for result panel consistency.

## Partner Pilot Buttons

Page: `/partner/orders`

- `Принять заказ` -> `acceptPartnerOrderDemoAction`;
- `Готов к выдаче` -> `markOrderReadyForPickupDemoAction`;
- `Сообщить проблему` -> `reportPartnerOrderIssueDemoAction`.

Page: `/partner/stop`

- `Пауза новых заказов` -> `pauseFutureOrdersDemoAction`;
- `Остановить весь бизнес` -> `pauseFullBusinessDemoAction`;
- `Экстренная остановка` -> `emergencyStopRequestDemoAction`.

Partner safety confirmed:

- accepted order cancellation is not executed directly;
- payment status is not changed;
- refund is not forced;
- alcohol module is not enabled;
- stop actions affect future demand only in demo wording.

## Courier Pilot Buttons

Page: `/courier/active`

- `Еду к партнёру` -> `markCourierToPartnerDemoAction`;
- `Забрал заказ` -> `markPickedUpDemoAction`;
- `Еду к клиенту` -> `markCourierToClientDemoAction`;
- `Доставлено` -> `markDeliveredDemoAction`.

Page: `/courier/issues`

- `Партнёр не готов` -> `reportPartnerNotReadyDemoAction`;
- `Клиент не отвечает` -> `reportClientNotAnsweringDemoAction`;
- `Проблема с адресом` -> `reportAddressProblemDemoAction`;
- `Нужен админ` -> `requestAdminSupportDemoAction`.

Courier safety confirmed:

- payment status is not changed;
- order items are not changed;
- order is not cancelled directly;
- refunds are not approved;
- alcohol module is not enabled.

## Admin and AI Dispatcher Pilot Buttons

Page: `/admin/delivery`

- `Назначить курьера` -> `assignCourierDemoAction`;
- `Переназначить курьера` -> `reassignCourierAfterPickupDemoAction`;
- `Отправить на проверку` -> local demo result `admin.mark_delivery_admin_review`;
- `Закрыть проблему доставки` -> `forceCloseDeliveryIssueRequestDemoAction`;
- `Запросить force complete` -> `forceCompleteOrderRequestDemoAction`.

Page: `/admin/ai-dispatcher`

- `Рекомендовать курьера` -> `recommendCourierAssignmentDemoAction`;
- `Рекомендовать переназначение` -> `recommendCourierReassignmentDemoAction`;
- `Создать alert задержки` -> `createDelayAlertDemoAction`;
- `Создать лог решения AI` -> `createAiDecisionLogDemoAction`;
- `Создать safety refusal log` -> `createAiSafetyRefusalLogDemoAction`.

Admin and AI safety confirmed:

- admin demo actions are requests only;
- AI recommendations do not execute real actions;
- payment, refund and status changes are not real;
- AI does not cancel orders;
- AI does not change payment status;
- AI does not approve refunds;
- AI does not enable alcohol module.

## Result Panel Behavior

All pilot client components render `DemoActionResultPanel` after click.

The result panel shows:

- clear demo mode label;
- result message;
- action name;
- role when provided;
- risk level when provided;
- audit warning when `auditRequired=true`;
- admin approval warning when `humanApprovalRequired=true`;
- `ALCOHOL_MODULE_ENABLED=false. Alcohol module disabled.`

Risk levels are limited to:

- `low`;
- `medium`;
- `high`;
- `critical`.

Roles are limited to:

- `partner`;
- `courier`;
- `admin`;
- `ai_dispatcher`;
- `client`.

## No Real Backend Writes

The pilot wiring:

- calls only demo action skeletons or local demo result helpers;
- does not call Supabase;
- does not mutate mock data;
- does not require environment variables;
- does not send notifications;
- does not process payments;
- does not connect Telegram or n8n;
- does not enable alcohol module.

## Next Recommended Stage

Stage 12H can continue with controlled demo wiring, validation schemas, or a small UI QA pass for demo action feedback. Real backend writes should still wait for auth, RLS, audit logs, approval flows and production safety checks.
