# ROW LEVEL SECURITY PLAN

## Назначение

Документ описывает будущую RLS/security strategy для KÖL / Issyk-Kul Travel & Delivery Platform. На этом этапе политики не создаются в Supabase и backend не подключается.

## Compliance note

Alcohol module remains OFF by default. No alcohol delivery or sales are enabled. Activation requires legal review, licensing, partner verification and admin approval. `ALCOHOL_MODULE_ENABLED=false`.

## Security principles

- Deny by default.
- Доступ выдаётся по роли и scope.
- Client scope = `auth.uid() = user_id/client_id`.
- Partner scope = пользователь привязан к `business_id` через `partner_staff`.
- Courier scope = назначенные доставки и собственный профиль.
- Admin scope = зависит от admin role.
- Finance data is restricted.
- AI dispatcher can write recommendations/logs, not final operational or finance decisions.
- Dangerous actions require human approval and audit log.

## Table-level access plan

### users / profiles / roles

Client:
- read own `users`, `user_profiles`, `client_profiles`;
- update safe own fields only.

Partner:
- read own user/profile;
- read staff within own `business_id` if owner/manager.

Courier:
- read/update own courier profile and availability.

Admin:
- support reads limited contact data;
- finance reads limited finance-relevant identity;
- super admin reads all.

RLS:
- `users.id = auth.uid()`;
- admin role helper functions for elevated access;
- `user_roles` write only super admin.

### partners / partner_staff / marketplace catalog

Guests:
- read public approved partners and active catalog.

Partners:
- read/write only rows where `business_id` is in own active `partner_staff`.

Admins:
- moderation/admin reads all;
- moderation can update review/moderation statuses.

RLS:
- `business_id in (select business_id from partner_staff where user_id = auth.uid() and is_active)`.

Dangerous actions:
- `stop_business`;
- archive partner;
- moderation rejection;
- alcohol-related catalog activation.

### orders / order_items / order_status_history

Clients:
- read own orders and items.
- create orders only via backend function after checkout validation.

Partners:
- read own business orders.
- update preparation statuses only: accept/reject/preparing/ready_for_pickup within allowed flow.

Couriers:
- read assigned delivery-linked orders.
- cannot update order payment or item contents.

Admins:
- read all according to role;
- support/admin can resolve disputes by policy.

AI:
- read operational summary if needed through server-side controlled view;
- write recommendations only.

RLS:
- client predicate: `orders.client_id = auth.uid()`.
- partner predicate: `orders.business_id in partner business scope`.
- courier predicate: `exists assigned delivery`.

Dangerous actions:
- cancellation after acceptance;
- refund;
- payment status update;
- manual total correction.

### bookings / guests / availability

Clients:
- read own bookings.
- create booking only through backend function after availability re-check.

Partners:
- read/write bookings for own business.
- confirm/reject within allowed flow.
- update availability for own rooms/tours.

Admins:
- resolve disputes and overbooking issues.

RLS:
- `room_availability.room_id` must resolve to partner-owned room.
- `tour_schedules.tour_id` must resolve to partner-owned tour.

Rules:
- `room_availability` is source of truth for room dates.
- `tour_schedules` is source of truth for tour capacity.
- closing dates/stopping items blocks only new orders/bookings.
- accepted bookings are not auto-cancelled.

Dangerous actions:
- cancelling confirmed booking;
- overriding closed/full date;
- no-show finalization.

### deliveries / courier assignments / issues

Clients:
- read delivery status for own order only.

Partners:
- read delivery status for own order.
- cannot close courier delivery.

Couriers:
- read assigned deliveries.
- update physical delivery statuses only.
- create delivery issues.

Admins/dispatchers:
- assign/reassign couriers;
- resolve issues;
- monitor delays.

AI:
- write recommendations/events/alerts only.

RLS:
- courier predicate: `assigned_courier_id = auth.uid()` or active assignment exists.
- partner predicate joins delivery -> order -> business scope.
- client predicate joins delivery -> order -> client_id.

Dangerous actions:
- cancel delivery;
- mark delivery_failed;
- reassign active delivery;
- close payment problem.

### finance

Tables:
- `payments`;
- `payouts`;
- `commissions`;
- `refunds`;
- `transactions`.

Clients:
- read own payment summary.

Partners:
- read own payout summary and commission summary.

Couriers:
- read own earnings/payout summary only.

Finance admin:
- read/write finance workflow rows.

Super admin:
- full audit access.

AI:
- no direct write to finance.

Dangerous actions:
- payment status change;
- refund approval;
- payout approval;
- commission update.

All require audit log and human approval.

### support / reviews / notifications

Clients:
- read/write own tickets/messages.
- read own notifications.
- create reviews for own completed orders/bookings.

Partners:
- read reviews for own business.
- reply to reviews if allowed.

Support admin:
- read assigned tickets and limited related entities.

RLS:
- ticket access by `created_by`, assigned support role, or related partner scope.
- notification access by `user_id = auth.uid()`.

### promos / loyalty / favorites

Clients:
- read own loyalty account and transactions.
- read own favorites.
- use promo through backend validation.

Partners:
- manage own business promo codes if allowed.

Admins:
- manage global promo rules.

RLS:
- loyalty rows scoped to `user_id`.
- partner promo rows scoped to `business_id`.

### AI dispatcher

Tables:
- `ai_dispatcher_events`;
- `ai_recommendations`;
- `ai_alerts`;
- `ai_decision_logs`.

AI service:
- insert events/recommendations/logs.
- cannot update order/payment/cancellation directly.

Admins:
- read and approve/reject recommendations.

Policy:
- high/critical risk always `human_approval_required=true`.
- AI never changes payment status.
- AI never cancels orders without admin approval.
- AI never enables alcohol delivery.

### Compliance / alcohol

Tables:
- `alcohol_module_settings`;
- `compliance_reviews`.

Default:
- `alcohol_module_settings.is_enabled=false`.

Access:
- read: super admin/compliance admin.
- write: super admin only with legal review reference.

Policy:
- alcohol routes/products/orders hidden while disabled.
- alcohol delivery and sales are not enabled.
- activation requires legal review, licenses, partner verification and admin approval.

## Audit log requirements

Every dangerous action must write:
- `actor_id`;
- `actor_role`;
- `action`;
- `entity_type`;
- `entity_id`;
- `before`;
- `after`;
- `reason`;
- `request_id`;
- `created_at`.

Dangerous actions:
- role changes;
- payment/refund/payout changes;
- accepted order cancellation;
- confirmed booking cancellation;
- courier reassignment after pickup;
- partner suspension;
- alcohol module activation;
- AI high-risk recommendation approval.

## Future helper functions

Recommended PostgreSQL helpers:
- `is_super_admin(user_id uuid)`;
- `has_admin_role(user_id uuid, role text)`;
- `partner_business_ids(user_id uuid)`;
- `is_partner_staff(user_id uuid, business_id uuid)`;
- `is_assigned_courier(user_id uuid, delivery_id uuid)`;
- `can_view_order(user_id uuid, order_id uuid)`;
- `can_view_booking(user_id uuid, booking_id uuid)`.
