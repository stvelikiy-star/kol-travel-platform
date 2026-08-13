# Supabase Write Actions Plan

## Статус Stage 12D-1

Документ описывает будущие write actions для KOL / Issyk-Kul Travel & Delivery Platform. На этом этапе код не реализуется, server actions не создаются, Supabase не подключается, auth/payments/Telegram/n8n не добавляются.

## Общие правила

- Все write actions должны выполняться только после внедрения auth, ролей, RLS и audit logs.
- Любое изменение money/payment/refund/status с высоким риском требует human/admin approval.
- AI dispatcher может создавать рекомендации, alerts и decision logs, но не выполняет опасные действия напрямую.
- `ALCOHOL_MODULE_ENABLED=false` остается default.
- Alcohol sales/delivery disabled до юридической проверки, лицензирования, partner verification и super_admin approval.

## Client Write Actions

| Action | Кто запускает | Роль | Target table | Audit log | High-risk approval | Notification later |
|---|---|---|---|---|---|---|
| create order | Клиент | `client` | `orders`, `order_items`, `order_status_history`, `order_delivery` | Да | Нет, если обычный заказ | Да |
| create booking | Клиент | `client` | `bookings`, `booking_guests`, `booking_status_history` | Да | Нет, если доступность подтверждена | Да |
| update profile | Клиент | `client` | `user_profiles`, `client_profiles` | Да | Нет | Нет |
| add/remove favorite | Клиент | `client` | `favorites` | Нет или low-level audit | Нет | Нет |
| create support ticket | Клиент | `client` | `support_tickets`, `ticket_messages` | Да | Нет | Да |
| create review | Клиент | `client` | `reviews` | Да | Может требовать moderation | Да |

Ограничения:

- Клиент может создавать и видеть только свои заказы, брони, tickets, favorites и профиль.
- Клиент не может менять partner status, payment status, delivery status или чужие данные.
- Отзывы могут попасть в moderation queue перед публикацией.

## Partner Write Actions

| Action | Кто запускает | Роль | Target table | Audit log | High-risk approval | Notification later |
|---|---|---|---|---|---|---|
| accept/reject order | Партнер | `partner_owner`, `partner_manager`, `partner_staff` | `orders`, `order_status_history` | Да | Может требоваться при позднем отказе | Да |
| mark preparing | Партнер | `partner_owner`, `partner_manager`, `partner_staff` | `orders`, `order_status_history` | Да | Нет | Да |
| mark ready_for_pickup | Партнер | `partner_owner`, `partner_manager`, `partner_staff` | `orders`, `order_status_history`, `deliveries` | Да | Нет | Да |
| confirm/reject booking | Партнер | `partner_owner`, `partner_manager` | `bookings`, `booking_status_history` | Да | Может требоваться при конфликте | Да |
| update catalog item | Партнер | `partner_owner`, `partner_manager` | `tours`, `stays`, `rooms`, `menu_items`, `products` | Да | Может требовать moderation | Нет |
| pause/stop item | Партнер | `partner_owner`, `partner_manager` | catalog tables, availability tables | Да | Нет, если не затрагивает принятые заявки | Да |
| update availability | Партнер | `partner_owner`, `partner_manager` | `room_availability`, `tour_schedules` | Да | Может требоваться при конфликте с принятой бронью | Нет |
| create promo | Партнер | `partner_owner`, `partner_manager` | `promo_codes` | Да | Может требовать moderation | Нет |
| reply to review | Партнер | `partner_owner`, `partner_manager` | `reviews` or future `review_replies` | Да | Может требовать moderation | Да |

Операционные правила:

- Партнер управляет только подготовкой заказа.
- После `ready_for_pickup` доставку контролируют courier, AI dispatcher и admin.
- Stop/pause item не удаляет позицию и не отменяет уже принятые заказы или брони.
- Закрытая дата/остановленная позиция блокирует только новые заявки.
- Партнер не может менять payment status.

## Courier Write Actions

| Action | Кто запускает | Роль | Target table | Audit log | High-risk approval | Notification later |
|---|---|---|---|---|---|---|
| accept delivery | Курьер | `courier` | `deliveries`, `delivery_status_history`, `courier_assignments` | Да | Нет | Да |
| mark courier_to_partner | Курьер | `courier` | `deliveries`, `delivery_status_history` | Да | Нет | Да |
| mark picked_up | Курьер | `courier` | `deliveries`, `delivery_status_history` | Да | Нет | Да |
| mark courier_to_client | Курьер | `courier` | `deliveries`, `delivery_status_history` | Да | Нет | Да |
| mark delivered | Курьер | `courier` | `deliveries`, `delivery_status_history`, `orders` | Да | Может требоваться при dispute/payment issue | Да |
| report issue | Курьер | `courier` | `delivery_issues`, `support_tickets` optional | Да | Да для high/critical | Да |
| update courier status | Курьер | `courier` | `courier_profiles`, `courier_shifts` | Да | Нет | Нет |

Ограничения:

- Курьер отвечает только за физическую доставку.
- Курьер не меняет payment status.
- Курьер не меняет order items.
- Курьер не отменяет заказ без admin approval.
- Alcohol delivery remains OFF.

## Admin Write Actions

| Action | Кто запускает | Роль | Target table | Audit log | High-risk approval | Notification later |
|---|---|---|---|---|---|---|
| assign/reassign courier | Admin/dispatcher | `dispatcher`, `support_admin`, `super_admin` | `deliveries`, `courier_assignments`, `delivery_status_history` | Да | Да для high/critical | Да |
| resolve issue | Admin/support | `support_admin`, `super_admin` | `delivery_issues`, `support_tickets`, `audit_logs` | Да | Может требоваться | Да |
| moderate partner/catalog | Admin | `support_admin`, `super_admin` | `partners`, catalog tables, `compliance_reviews` | Да | Да для sensitive content | Да |
| approve refund later | Finance/Admin | `finance_admin`, `super_admin` | `refunds`, `transactions`, `payments` | Да | Да | Да |
| update settings | Admin | `super_admin` | settings tables, `alcohol_module_settings` | Да | Да | Нет |
| approve high-risk AI recommendation | Admin | `support_admin`, `dispatcher`, `super_admin` | `ai_recommendations`, `ai_decision_logs`, target workflow table | Да | Да | Да |

Ограничения:

- Finance changes require human/admin approval.
- Accepted orders/bookings require admin rules before cancellation.
- Любое действие с платежами, возвратами, блокировками и legal-sensitive settings должно иметь audit log.
- Admin actions remain demo until backend and auth are implemented.

## AI Dispatcher Write Actions

| Action | Кто запускает | Роль | Target table | Audit log | High-risk approval | Notification later |
|---|---|---|---|---|---|---|
| create recommendation | AI dispatcher | system AI role | `ai_recommendations` | Да | Да, если high/critical | Да |
| create alert | AI dispatcher | system AI role | `ai_alerts` | Да | Может требоваться | Да |
| create decision log | AI dispatcher | system AI role | `ai_decision_logs` | Да | Да для high/critical | Нет |

AI dispatcher запреты:

- never cancel order directly;
- never change payment status;
- never enable alcohol module;
- never promise delivery time without data;
- never invent facts;
- never execute high-risk changes without human admin approval.

## Compliance

- `ALCOHOL_MODULE_ENABLED=false`.
- Alcohol sales/delivery disabled.
- Activation requires legal review, valid licensing, partner verification and `super_admin` approval.
- AI cannot enable alcohol module.
- Any future alcohol-related write action must be behind global module flag, partner-level approval, age checks and compliance audit logs.

## Перед реализацией кода

1. Завершить auth/session model.
2. Проверить RLS policies на каждой target table.
3. Добавить server-only write layer.
4. Добавить audit logs для всех mutations.
5. Добавить human approval workflow для high-risk actions.
6. Проверить rollback и incident response.
