# Internal Demo Actions Connection Map

Stage: 12G-1 - Internal Demo Actions Connection Map.

This document maps future UI buttons to safe demo action skeletons for partner, courier, admin and AI dispatcher internal operations. It is a planning contract only: no buttons are connected yet, no UI behavior changes are made, no Supabase writes are used, and no real backend logic is implemented.

`ALCOHOL_MODULE_ENABLED=false` by default. Alcohol sales and delivery are disabled. AI, partner, courier and admin demo actions cannot enable alcohol module.

## Wiring Rules

- Low and medium demo buttons may show a demo toast later.
- High and critical demo buttons must show approval and audit warnings later.
- Demo actions must not mutate data.
- Real backend wiring comes later after auth, RLS, audit logs and approval flows.
- AI can recommend, alert and log only.
- AI cannot execute high-risk actions.
- AI cannot cancel orders.
- AI cannot change payment status.
- AI cannot approve refunds.
- AI cannot enable alcohol module.
- Any alcohol-related request is critical risk and requires legal review, licensing, partner verification and `super_admin` approval later.

## Partner Mapping

### `/partner/orders`

| UI button label | Demo action name | Role | Risk | Audit | Human approval | Future backend table or area | Safety note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Принять заказ | `acceptPartnerOrderDemoAction` | partner | low | no | no | `orders`, `order_status_history` | Partner accepts preparation responsibility only. |
| Отклонить заказ | `rejectPartnerOrderDemoAction` | partner | medium | yes | no | `orders`, `order_status_history`, `audit_logs` | Allowed before acceptance; later real rules must validate status. |
| Начать приготовление | `markOrderPreparingDemoAction` | partner | low | no | no | `orders`, `order_status_history` | Does not affect delivery or payment. |
| Готов к выдаче | `markOrderReadyForPickupDemoAction` | partner | medium | yes | no | `orders`, `order_delivery`, `deliveries` | Handoff begins; courier, AI dispatcher and admin control delivery after pickup. |
| Сообщить проблему | `reportPartnerOrderIssueDemoAction` | partner | high | yes | yes | `delivery_issues`, `support_tickets`, `audit_logs` | Partner reports issue; does not cancel order. |
| Запросить отмену принятого заказа | `requestAcceptedOrderCancellationDemoAction` | partner | high | yes | yes | `orders`, `audit_logs`, approval workflow | Accepted order cancellation requires admin approval later. |

### `/partner/bookings`

| UI button label | Demo action name | Role | Risk | Audit | Human approval | Future backend table or area | Safety note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Подтвердить бронь | `confirmPartnerBookingDemoAction` | partner | low | no | no | `bookings`, `booking_status_history` | Confirms booking in demo only. |
| Отклонить бронь | `rejectPartnerBookingDemoAction` | partner | medium | yes | no | `bookings`, `booking_status_history`, `audit_logs` | Must validate availability and status later. |
| Гость прибыл | `markGuestArrivedDemoAction` | partner | low | no | no | `bookings`, `booking_status_history` | Stay/tour operational status only. |
| Сообщить проблему по брони | `reportPartnerBookingIssueDemoAction` | partner | high | yes | yes | `support_tickets`, `audit_logs` | Does not cancel confirmed booking. |
| Запросить отмену подтверждённой брони | `requestConfirmedBookingCancellationDemoAction` | partner | high | yes | yes | `bookings`, approval workflow, `audit_logs` | Confirmed booking cancellation requires admin approval later. |

### `/partner/stop`

| UI button label | Demo action name | Role | Risk | Audit | Human approval | Future backend table or area | Safety note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Пауза новых заказов | `pauseFutureOrdersDemoAction` | partner | medium | yes | no | partner stop settings, `audit_logs` | Blocks future orders only. |
| Пауза новых броней | `pauseFutureBookingsDemoAction` | partner | medium | yes | no | partner stop settings, `audit_logs` | Blocks future bookings only. |
| Остановить весь бизнес | `pauseFullBusinessDemoAction` | partner | high | yes | yes | partner stop settings, approval workflow | Does not cancel accepted orders or confirmed bookings. |
| Возобновить работу | `resumeBusinessDemoAction` | partner | medium | yes | no | partner stop settings, `audit_logs` | Resumes future availability only. |
| Экстренная остановка | `emergencyStopRequestDemoAction` | partner | critical | yes | yes | approval workflow, `audit_logs` | Requires admin review later. |

### `/partner/catalog`

| UI button label | Demo action name | Role | Risk | Audit | Human approval | Future backend table or area | Safety note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Остановить позицию | `pauseCatalogItemDemoAction` | partner | medium | yes | no | catalog item status, `audit_logs` | Hides from new orders/bookings only. |
| Возобновить позицию | `resumeCatalogItemDemoAction` | partner | medium | yes | no | catalog item status, `audit_logs` | Does not alter accepted orders/bookings. |
| Нет в наличии | `markCatalogItemOutOfStockDemoAction` | partner | medium | yes | no | stock/status fields, `audit_logs` | Future orders only. |
| Остановить категорию | `pauseCatalogCategoryDemoAction` | partner | high | yes | yes | catalog category status, approval workflow | Broad stop requires warning later. |
| Сообщить проблему по позиции | `reportCatalogIssueDemoAction` | partner | medium | yes | no | support/moderation, `audit_logs` | Does not delete item. |

### `/partner/availability`

| UI button label | Demo action name | Role | Risk | Audit | Human approval | Future backend table or area | Safety note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Заблокировать дату | `blockAvailabilityDateDemoAction` | partner | medium | yes | no | `room_availability`, `tour_schedules` | Blocks future bookings only. |
| Разблокировать дату | `unblockAvailabilityDateDemoAction` | partner | medium | yes | no | `room_availability`, `tour_schedules` | Must avoid overbooking later. |
| Заблокировать слот | `blockAvailabilitySlotDemoAction` | partner | medium | yes | no | availability slots | Blocks future slot only. |
| Обновить заметку | `updateAvailabilityNoteDemoAction` | partner | low | no | no | availability notes | Demo note only. |
| Сообщить конфликт доступности | `reportAvailabilityConflictDemoAction` | partner | high | yes | yes | support/admin review, `audit_logs` | Accepted bookings require admin rules before cancellation. |

## Courier Mapping

### `/courier/deliveries` and `/courier/active`

| UI button label | Demo action name | Role | Risk | Audit | Human approval | Future backend table or area | Safety note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Принять доставку | `acceptDeliveryDemoAction` | courier | low | no | no | `deliveries`, `delivery_status_history` | Courier accepts physical delivery only. |
| Еду к партнёру | `markCourierToPartnerDemoAction` | courier | low | no | no | `deliveries`, `delivery_status_history` | Does not change partner preparation status. |
| Прибыл к партнёру | `markArrivedAtPartnerDemoAction` | courier | low | no | no | `deliveries`, `delivery_status_history` | Physical progress only. |
| Забрал заказ | `markPickedUpDemoAction` | courier | low | no | no | `deliveries`, `delivery_status_history` | After pickup, partner cannot cancel without admin. |
| Еду к клиенту | `markCourierToClientDemoAction` | courier | low | no | no | `deliveries`, `delivery_status_history` | Does not change payment or order items. |
| Прибыл к клиенту | `markArrivedAtClientDemoAction` | courier | low | no | no | `deliveries`, `delivery_status_history` | Physical progress only. |
| Доставлено | `markDeliveredDemoAction` | courier | low | no | no | `deliveries`, `delivery_status_history` | Completion status must be validated later. |

### `/courier/issues`

| UI button label | Demo action name | Role | Risk | Audit | Human approval | Future backend table or area | Safety note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Партнёр не готов | `reportPartnerNotReadyDemoAction` | courier | medium | yes | no | `delivery_issues`, `ai_alerts` | AI/admin may monitor delay. |
| Выдали не тот заказ | `reportWrongOrderDemoAction` | courier | high | yes | no | `delivery_issues`, `audit_logs` | Must not change order items directly. |
| Клиент не отвечает | `reportClientNotAnsweringDemoAction` | courier | medium | yes | no | `delivery_issues`, `notifications` | Admin escalation may be needed later. |
| Проблема с адресом | `reportAddressProblemDemoAction` | courier | high | yes | no | `delivery_issues`, `audit_logs` | Courier cannot edit client address without rules. |
| Пробка / задержка | `reportTrafficDelayDemoAction` | courier | medium | yes | no | `delivery_issues`, `ai_alerts` | Delay tracking only. |
| Проблема с транспортом | `reportVehicleProblemDemoAction` | courier | high | yes | no | `delivery_issues`, `courier_assignments` | Reassignment after pickup needs admin. |
| Заказ повреждён | `reportOrderDamagedDemoAction` | courier | high | yes | no | `delivery_issues`, `audit_logs` | Refund/payment changes require admin. |
| Экстренный случай | `reportEmergencyIncidentDemoAction` | courier | critical | yes | yes | emergency escalation, `audit_logs` | Critical safety flow requires human admin. |
| Нужен админ | `requestAdminSupportDemoAction` | courier | high | yes | yes | admin escalation, `audit_logs` | Demo request only. |

### `/courier/profile`

| UI button label | Demo action name | Role | Risk | Audit | Human approval | Future backend table or area | Safety note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Выйти на линию / уйти с линии | `updateCourierAvailabilityDemoAction` | courier | low | no | no | `courier_profiles`, `courier_shifts` | Availability only; payouts are not changed. |
| Статус смены | `updateCourierShiftStatusDemoAction` | courier | low | no | no | `courier_shifts` | Valid statuses must be enforced later. |
| Проблема профиля | `reportCourierProfileIssueDemoAction` | courier | medium | yes | no | support/admin review | Does not change payments or identity data directly. |

## Admin Mapping

Admin mapping below is a future UI wiring map. Some requested UI action names are product-facing aliases; current skeleton files may expose equivalent request-oriented names that should be aligned in a later action-alias stage before UI wiring.

### `/admin/delivery`

| UI button label | Demo action name | Role | Risk | Audit | Human approval | Future backend table or area | Safety note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Назначить курьера | `assignCourierDemoAction` | admin | high | yes | true | `courier_assignments`, `deliveries`, `audit_logs` | Assignment is demo request only. |
| Переназначить курьера | `reassignCourierDemoAction` | admin | high | yes | true | `courier_assignments`, approval workflow | If after pickup, requires stricter audit. Current equivalent: `reassignCourierAfterPickupDemoAction`. |
| Отправить на проверку | `markDeliveryAdminReviewDemoAction` | admin | medium | yes | no | `delivery_issues`, admin review queue | Review marker only. |
| Закрыть проблему доставки | `forceCloseDeliveryIssueDemoAction` | admin | high | yes | true | `delivery_issues`, `audit_logs` | Future equivalent may wrap `forceCloseDeliveryIssueRequestDemoAction`. |
| Запросить force complete | `requestForceCompleteOrderDemoAction` | admin | critical | yes | true | `orders`, approval workflow, `audit_logs` | Force completion requires human/admin approval and audit. |

### `/admin/ai-dispatcher`

| UI button label | Demo action name | Role | Risk | Audit | Human approval | Future backend table or area | Safety note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Классифицировать проблему | `classifyIssueSeverityDemoAction` | admin | medium | yes | no | AI/admin review | Classification does not execute action. |
| Эскалировать проблему | `escalateIssueDemoAction` | admin | high | yes | true | escalation workflow, `audit_logs` | High-risk escalation needs human admin. |
| Решить проблему | `resolveIssueDemoAction` | admin | high | yes | true | `delivery_issues`, `audit_logs` | Resolution is demo request only. |
| Экстренное действие | `requestEmergencyActionDemoAction` | admin | critical | yes | true | emergency approval workflow | Critical actions require audit and approval. |

### `/admin/moderation`

| UI button label | Demo action name | Role | Risk | Audit | Human approval | Future backend table or area | Safety note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Одобрить партнёра | `approvePartnerDemoAction` | admin | high | yes | true | `partners`, moderation, `audit_logs` | Current equivalent may use `verifyPartnerRequestDemoAction`. |
| Заблокировать партнёра | `blockPartnerDemoAction` | admin | critical | yes | true | `partners`, `audit_logs` | Blocking is high-impact. Current equivalent: `blockPartnerRequestDemoAction`. |
| Разблокировать партнёра | `unblockPartnerDemoAction` | admin | critical | yes | true | `partners`, `audit_logs` | Requires review later. |
| Одобрить позицию | `approveCatalogItemDemoAction` | admin | high | yes | true | catalog moderation, `audit_logs` | Current equivalent may use `moderateCatalogItemDemoAction`. |
| Скрыть позицию | `hideCatalogItemDemoAction` | admin | high | yes | true | catalog moderation, `audit_logs` | Does not delete catalog item. |
| Заблокировать курьера | `blockCourierDemoAction` | admin | critical | yes | true | `courier_profiles`, `audit_logs` | Current equivalent: `blockCourierRequestDemoAction`. |
| Разблокировать курьера | `unblockCourierDemoAction` | admin | critical | yes | true | `courier_profiles`, `audit_logs` | Requires admin approval later. |

### `/admin/finance`

| UI button label | Demo action name | Role | Risk | Audit | Human approval | Future backend table or area | Safety note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Проверить оплату | `reviewPaymentIssueDemoAction` | admin | high | yes | true | `payments`, finance review | Review only; no payment mutation. |
| Запросить изменение статуса оплаты | `requestPaymentStatusChangeDemoAction` | admin | critical | yes | true | `payments`, approval workflow, `audit_logs` | Payment status changes require strict audit. |
| Запросить возврат | `requestRefundApprovalDemoAction` | admin | critical | yes | true | `refunds`, approval workflow, `audit_logs` | Current equivalent may use `approveRefundRequestDemoAction` as a demo request. |
| Проверить выплату | `reviewPayoutIssueDemoAction` | admin | high | yes | true | `payouts`, finance review | Payout review only. |

### `/admin/users`

| UI button label | Demo action name | Role | Risk | Audit | Human approval | Future backend table or area | Safety note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Проверить смену роли | `reviewUserRoleChangeDemoAction` | admin | critical | yes | true | `user_roles`, approval workflow, `audit_logs` | Current equivalent may use `changeUserRoleRequestDemoAction`. |
| Запросить блокировку | `requestUserBlockDemoAction` | admin | high | yes | true | user status, `audit_logs` | Current equivalent may use `blockUserRequestDemoAction`. |
| Запросить разблокировку | `requestUserUnblockDemoAction` | admin | high | yes | true | user status, `audit_logs` | Current equivalent may use `unblockUserRequestDemoAction`. |
| Проверить подозрительного пользователя | `reviewSuspiciousUserDemoAction` | admin | high | yes | true | moderation/security review | Review only. |

## AI Dispatcher Mapping

| UI button label | Demo action name | Role | Risk | Audit | Human approval | Future backend table or area | Safety note |
| --- | --- | --- | --- | --- | --- | --- |
| Рекомендовать курьера | `recommendCourierAssignmentDemoAction` | ai_dispatcher | medium | yes | no | `ai_recommendations`, `courier_assignments` | AI recommends only. |
| Рекомендовать переназначение | `recommendCourierReassignmentDemoAction` | ai_dispatcher | high | yes | yes | `ai_recommendations`, approval workflow | Human admin approves later. |
| Рекомендовать паузу партнёра | `recommendPartnerPauseDemoAction` | ai_dispatcher | medium | yes | no | `ai_recommendations`, partner stop review | AI cannot pause partner directly. |
| Рекомендовать эскалацию | `recommendIssueEscalationDemoAction` | ai_dispatcher | high | yes | yes | `ai_recommendations`, escalation workflow | Recommendation only. |
| Рекомендовать проверку админом | `recommendAdminReviewDemoAction` | ai_dispatcher | high | yes | yes | `ai_recommendations`, admin review queue | Human review required later. |
| Черновик сообщения клиенту | `recommendCustomerMessageDemoAction` | ai_dispatcher | low | no | no | message drafts, notifications later | Draft only; no notification sent. |
| Создать alert задержки | `createDelayAlertDemoAction` | ai_dispatcher | medium | yes | no | `ai_alerts` | Alert only. |
| Создать лог решения AI | `createAiDecisionLogDemoAction` | ai_dispatcher | low | yes | no | `ai_decision_logs` | Log only. |
| Создать safety refusal log | `createAiSafetyRefusalLogDemoAction` | ai_dispatcher | high | yes | no | `ai_decision_logs`, audit review | Logs refusal of unsafe/high-risk request. |

## Future Wiring Checklist

Before any button is connected:

- verify the exact exported function name exists;
- add aliases only in action files during a dedicated action-alias stage if needed;
- validate input shape and safe error handling;
- show demo toast for low/medium actions;
- show audit/approval warning for high/critical actions;
- keep all actions demo-only until backend writes are explicitly approved;
- keep `ALCOHOL_MODULE_ENABLED=false`;
- confirm AI still cannot execute cancellation, payment, refund, blocking, force-complete or alcohol activation actions.
