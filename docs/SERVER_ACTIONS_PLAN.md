# Server Actions Plan

## Статус Stage 12D-2

Документ описывает будущую структуру Next.js server actions для KOL / Issyk-Kul Travel & Delivery Platform. На этом этапе код не реализуется, реальные server actions не создаются, Supabase write operations не выполняются.

## Цель

Server actions должны стать безопасным backend-слоем между UI, auth/RLS, audit logs и будущей Supabase database. Они будут использоваться только после внедрения реальной авторизации, ролей, ownership checks и production security review.

## Proposed Folder Structure

```txt
src/app/actions/
  client/
  partner/
  courier/
  admin/
  ai-dispatcher/
```

Каждая группа actions должна быть разделена по роли и домену, чтобы UI не вызывал опасные операции напрямую.

## Client Actions

Будущая папка:

```txt
src/app/actions/client/
```

Планируемые файлы:

- `clientOrders.ts` - create order, validate cart, create order items, create initial status history.
- `clientBookings.ts` - create booking, validate dates/guests, create booking guests, create initial status history.
- `clientProfile.ts` - update client profile, delivery addresses, notification preferences.
- `clientSupport.ts` - create support ticket and ticket messages.
- `clientReviews.ts` - create review, send to moderation if needed.

Правила:

- Role required: `client`.
- Validate ownership: клиент может менять только свой профиль, свои tickets, свои favorites/reviews.
- Sensitive actions write audit log: orders, bookings, support tickets, reviews.
- Notifications later: order/booking/support/review events.
- Safe errors only: no stack traces, SQL details, secrets or internal policy messages in UI.

## Partner Actions

Будущая папка:

```txt
src/app/actions/partner/
```

Планируемые файлы:

- `partnerOrders.ts` - accept/reject order, mark preparing, mark ready_for_pickup, report order problem.
- `partnerBookings.ts` - confirm/reject booking, request date change, report booking problem.
- `partnerCatalog.ts` - update tour/stay/room/menu item/product, pause/stop item.
- `partnerAvailability.ts` - update room availability and tour schedules.
- `partnerPromos.ts` - create/update/stop promo codes.
- `partnerReviews.ts` - reply to reviews, flag review for moderation.

Правила:

- Role required: `partner_owner`, `partner_manager`, or scoped `partner_staff`.
- Validate ownership: партнер видит и меняет только свой business/catalog/orders/bookings.
- Partner controls preparation only.
- After `ready_for_pickup`, courier, AI dispatcher and admin control delivery.
- Stop/pause item/date blocks only new orders/bookings and never cancels accepted orders/bookings.
- No direct payment status changes.
- Sensitive actions write audit log.

## Courier Actions

Будущая папка:

```txt
src/app/actions/courier/
```

Планируемые файлы:

- `courierDeliveries.ts` - accept delivery, mark courier_to_partner, picked_up, courier_to_client, delivered.
- `courierIssues.ts` - report delivery issue, attach issue category and priority.
- `courierProfile.ts` - update courier profile, vehicle info, working zone, language.
- `courierShifts.ts` - update courier availability/status and shift data.

Правила:

- Role required: `courier`.
- Validate assignment: courier can update only assigned delivery or explicitly available delivery.
- Courier controls only physical delivery.
- Courier cannot change payment status.
- Courier cannot change order items.
- Courier cannot cancel order without admin approval.
- High-risk issue reports create audit log and notify admin later.

## Admin Actions

Будущая папка:

```txt
src/app/actions/admin/
```

Планируемые файлы:

- `adminDelivery.ts` - assign/reassign courier, resolve delivery issue, approve high-risk delivery action.
- `adminModeration.ts` - approve/reject partner verification, catalog item, review, complaint.
- `adminFinance.ts` - prepare refund/payout/commission actions later, with strict approval and audit.
- `adminSettings.ts` - update platform settings, feature flags, compliance settings.
- `adminUsers.ts` - manage demo-to-real users, role assignments, blocks/suspensions.

Правила:

- Role required depends on action: `support_admin`, `dispatcher`, `finance_admin`, `super_admin`.
- Validate admin permission before every action.
- Finance changes require human/admin approval.
- No direct payment status changes without explicit finance/admin rules.
- No order/booking cancellation without cancellation rules, audit log and approval.
- All sensitive admin actions write audit log.
- Service role key is server-only and must never be exposed to browser.

## AI Dispatcher Actions

Будущая папка:

```txt
src/app/actions/ai-dispatcher/
```

Планируемые файлы:

- `aiRecommendations.ts` - create AI recommendation for stuck orders, delays, courier assignment, escalation.
- `aiAlerts.ts` - create internal alerts for admin/dispatcher review.
- `aiDecisionLogs.ts` - store decision context, risk level, recommended action and approval requirement.

Правила:

- AI can recommend but cannot execute high-risk actions.
- AI cannot cancel orders.
- AI cannot change payment status.
- AI cannot enable alcohol module.
- AI cannot promise delivery time without data.
- AI must not invent facts.
- High/critical risk requires human/admin approval.

## Shared Server Action Rules

Every future action must:

1. Validate role before action.
2. Validate ownership before action.
3. Validate input schema before database write.
4. Write audit log for sensitive actions.
5. Return safe errors only.
6. Never expose service role key to browser.
7. Avoid direct payment status changes without admin/finance approval.
8. Avoid order/booking cancellation without formal rules.
9. Keep AI recommendation-only for high-risk decisions.
10. Keep alcohol module OFF unless compliance process is completed.

## Error Handling

Server actions should return a safe result shape:

```ts
type ActionResult<T> = {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
};
```

Errors must not include:

- service role key;
- raw SQL;
- stack trace;
- internal RLS policy text;
- private user data from another role.

## Audit Log Requirements

Audit logs are required for:

- order and booking status changes;
- delivery assignment/reassignment;
- support and issue resolution;
- catalog moderation;
- partner suspension or approval;
- refunds, payouts and commissions;
- settings and feature flag changes;
- any high-risk AI recommendation approval.

## Compliance

- `ALCOHOL_MODULE_ENABLED=false`.
- Alcohol sales/delivery disabled.
- Activation requires legal review, licensing, partner verification and `super_admin` approval.
- AI cannot enable alcohol module.
- Future alcohol-related server actions must be gated by global module setting, partner approval, age checks, audit logs and legal review.

## Not Implemented Yet

На Stage 12D-2 не создаются:

- real server actions;
- Supabase writes;
- auth/session validation code;
- payments;
- Telegram/n8n notifications;
- alcohol module activation.
