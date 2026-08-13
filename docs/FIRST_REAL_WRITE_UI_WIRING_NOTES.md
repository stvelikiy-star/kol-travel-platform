# Stage 12R-4 - First Real Write UI Wiring Notes

## Scope

This stage wires one controlled partner UI pilot for the first real backend write:

- Page: `/partner/orders`
- Button: `Готов к выдаче — real test`
- Real action: `markOrderReadyForPickupAction(orderId)`
- Seeded test order: `50000000-0000-0000-0000-000000000001`

The existing demo action flow remains in place and was not removed.

## Safe Gate

The real pilot is gated by `DATA_SOURCE_MODE=supabase`.

Default local mode remains:

```env
DATA_SOURCE_MODE=mock
ALCOHOL_MODULE_ENABLED=false
```

When `DATA_SOURCE_MODE=mock`, the real test button is disabled and normal local testing should continue through the existing demo controls. The server-side pilot action also checks the mode before calling the real action, so disabling the button is not the only guard.

## Result Display

The page uses `DemoActionResultPanel` to display the safe result returned by the pilot.

The result panel can now display:

- demo or real pilot mode
- action name
- role
- risk level
- audit warning
- admin approval warning
- safe error code
- `auditLogId` when returned
- `ALCOHOL_MODULE_ENABLED=false. Alcohol module disabled.`

Raw Supabase errors, SQL details, auth tokens, service role keys and private env values must never be shown.

## Error Handling Fix

The pilot previously could return `invalid_order_id` for deterministic seeded test UUIDs because the UUID validator only accepted RFC versioned UUIDs. The Supabase seed uses fixed test UUIDs such as `50000000-0000-0000-0000-000000000001`, so the validator now accepts the standard UUID group shape without requiring a version nibble.

The `/partner/orders` result renderer also maps known safe codes to safe UI messages:

- `invalid_order_id`
- `not_authenticated`
- `not_authorized`
- `profile_not_found`
- `ownership_failed`
- `order_not_found`
- `invalid_status_transition`
- `database_update_failed`
- `audit_insert_failed`
- `server_error`

This prevents stale or incomplete query messages from being shown as raw/internal UI text.

## Audit Schema Mapping

The current SQL schema uses:

- `action`
- `entity_type`
- `entity_id`

The pilot writes audit rows with those schema-specific fields:

- `action = mark_order_ready_for_pickup`
- `entity_type = orders`
- `entity_id = orderId`

## What Was Not Changed

This pilot does not wire any payment, refund, cancellation or delivery-completion action.

The UI wiring must not change:

- `payment_status`
- subtotal, delivery fee, discount or total
- order items
- client or business ownership fields
- courier assignment or delivery completion fields
- cancelled, refunded, picked up or delivered fields
- alcohol settings

## Known Limitations

`markOrderReadyForPickupAction` is still a controlled real-write pilot helper. It is called through a server-side form action from the partner orders page, while the rest of the partner actions remain demo-only.

The pilot expects the manual Supabase test setup to contain a partner-owned order in an allowed source status, such as `preparing` or `accepted_by_partner`.

## Rollback

If the pilot causes problems:

1. Keep `DATA_SOURCE_MODE=mock`.
2. Revert the `/partner/orders` pilot card only.
3. Keep `markOrderReadyForPickupDemoAction(orderId)`.
4. Run `npm run build`.
5. Verify `/partner/orders` opens and demo actions still show safe demo results.

## Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`
- The pilot does not touch `alcohol_module_settings`.
- Partner, courier and admin actions cannot enable alcohol.
- AI cannot enable alcohol.
- Super admin activation, if ever legally allowed, still requires legal review, licensing and partner verification.
