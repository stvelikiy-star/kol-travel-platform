# Server Actions Skeleton

## Статус Stage 12E-1

Создан безопасный demo skeleton для будущих client server actions. На этом этапе реальные server actions, Supabase writes, auth checks, payments, Telegram/n8n и alcohol module не подключаются.

## Что создано

Shared result helper:

- `src/app/actions/shared/action-result.ts`

Client action skeletons:

- `src/app/actions/client/clientOrders.ts`
- `src/app/actions/client/clientBookings.ts`
- `src/app/actions/client/clientProfile.ts`
- `src/app/actions/client/clientSupport.ts`
- `src/app/actions/client/clientReviews.ts`

## Demo Result Format

Все demo actions возвращают `DemoActionResult`:

```ts
{
  ok: boolean;
  mode: "demo";
  action: string;
  message: string;
  humanApprovalRequired?: boolean;
  auditRequired?: boolean;
  alcoholModuleEnabled?: false;
}
```

Helper `createDemoActionResult()` всегда возвращает `alcoholModuleEnabled: false`.

## Client Actions Created

Orders:

- `createOrderDemoAction(input: unknown)`
- `cancelOrderRequestDemoAction(orderId: string, reason: string)`

Bookings:

- `createBookingDemoAction(input: unknown)`
- `cancelBookingRequestDemoAction(bookingId: string, reason: string)`
- `updateBookingRequestDemoAction(bookingId: string, input: unknown)`

Profile:

- `updateClientProfileDemoAction(input: unknown)`
- `updateClientAddressDemoAction(input: unknown)`

Support:

- `createSupportTicketDemoAction(input: unknown)`
- `replySupportTicketDemoAction(ticketId: string, message: string)`

Reviews:

- `createReviewDemoAction(input: unknown)`
- `updateReviewDemoAction(reviewId: string, input: unknown)`

## Safety Rules

- No real writes.
- No Supabase write client.
- No service role key usage.
- No mock data mutation.
- No payment status changes.
- Accepted orders/bookings require admin approval before cancellation.
- Real implementation must validate auth, role, ownership, RLS and audit log.
- `ALCOHOL_MODULE_ENABLED=false` remains default.
- Alcohol sales/delivery remain disabled.

## Next Planned Groups

Future skeleton stages:

- Partner actions.
- Courier actions.
- Admin actions.
- AI dispatcher actions.

AI dispatcher must remain recommendation-only for high-risk actions and must never cancel orders, change payment status or enable alcohol module.
