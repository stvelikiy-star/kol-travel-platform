# Stage 12R-3 - First Real Write Implementation Notes

Project: KOL / Issyk-Kul Travel & Delivery Platform.

This stage implemented the first real backend write action only:

- `markOrderReadyForPickupAction(orderId)`

It did not wire UI buttons, remove demo actions, protect routes, create login UI, mutate mock data, change payments, change delivery completion flow, or enable alcohol module.

## Files Changed

- `src/app/actions/partner/partnerOrders.ts`
- `docs/FIRST_REAL_WRITE_IMPLEMENTATION_NOTES.md`
- `README.md`

## Real Action Implemented

`markOrderReadyForPickupAction(orderId)` is implemented as a server-intended async real write helper with safe result shape:

- `mode = "real"`
- `action = "mark_order_ready_for_pickup"`
- `role = "partner"`
- `riskLevel = "medium"`
- `auditRequired = true`
- `humanApprovalRequired = false`
- `alcoholModuleEnabled = false`

The existing `markOrderReadyForPickupDemoAction(orderId)` remains unchanged and available.

## Validation Flow

The action validates:

1. `orderId` is a UUID.
2. Supabase server env exists.
3. Partner profile exists for the seeded demo partner actor.
4. Partner profile resolves `business_id`.
5. Order exists.
6. `order.business_id === partnerProfile.business_id`.
7. Order status is allowed.
8. Update touches only allowed fields.
9. Audit log is created after update.

## Ownership Logic

The schema uses:

- `orders.business_id`
- `partner_profiles.business_id`

The action loads the partner profile by the seeded demo partner auth user id:

- `00000000-0000-0000-0000-000000000003`

Then it verifies:

- `order.business_id === partnerProfile.business_id`

Known limitation: route/login UI is not active yet, so this implementation is a first real write pilot for the seeded test partner. Before production UI wiring, this must be replaced with real authenticated user session resolution.

Additional Next.js limitation: `partnerOrders.ts` is currently imported by a client demo component for existing demo actions. Because of that, the real function cannot include an inline `"use server"` directive in this file without breaking the build. Before UI wiring, move the real action to a server-only module or split demo client actions from real server actions.

## Allowed Status Transition

Allowed source statuses:

- `preparing`
- `accepted_by_partner`

Target status:

- `ready_for_pickup`

Blocked statuses return `invalid_status_transition`, including:

- `new`
- `rejected`
- `cancelled`
- `picked_up`
- `courier_to_client`
- `delivered`
- `refunded`
- `admin_required`
- unknown status

## Fields Updated

Only these order fields are updated:

- `status = ready_for_pickup`
- `updated_at = now`

The action does not update:

- `payment_status`
- `subtotal`
- `delivery_fee`
- `discount`
- `total`
- `order_items`
- `client_id`
- `business_id`
- courier fields
- `picked_up_at`
- `delivered_at`
- `cancelled_at`
- `refunded_at`
- alcohol-related fields

The current `orders` table does not include `ready_for_pickup_at`, so the action does not attempt to update it.

## Audit Behavior

After the order update, the action inserts an audit record into `audit_logs` using the actual schema columns:

- `actor_id`
- `actor_role`
- `action`
- `entity_type`
- `entity_id`
- `before`
- `after`
- `reason`
- `request_id`

Safe before/after summaries include only:

- `id`
- `business_id`
- `status`
- `payment_status`
- `updated_at`

Known limitation: this stage uses direct server-side Supabase REST calls because the previously created `createAuditLogEntry` helper is still a safe placeholder and does not perform a real insert yet.

If the order update succeeds but audit insert fails, the action returns:

- `audit_insert_failed`

The message clearly states that the order may have been updated and the test database should be reviewed before continuing.

## Safe Error Behavior

Possible safe error codes:

- `invalid_order_id`
- `profile_not_found`
- `ownership_failed`
- `order_not_found`
- `invalid_status_transition`
- `database_update_failed`
- `audit_insert_failed`
- `server_error`

The action never exposes:

- raw Supabase error;
- SQL details;
- service role key;
- auth token;
- private env values.

## UI Not Wired Yet

No UI buttons were changed.

`/partner/orders` continues to use demo action wiring until a separate UI wiring stage explicitly changes it.

## Demo Action Remains

`markOrderReadyForPickupDemoAction(orderId)` remains unchanged and available as the safe fallback.

## Rollback Path

If this real action causes issues:

1. Keep `DATA_SOURCE_MODE=mock`.
2. Keep UI wired to demo action.
3. Revert only the real action implementation in `partnerOrders.ts`.
4. Run `npm run build`.
5. Review the Supabase TEST project manually if the action was invoked.

## Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`.
- This action does not enable alcohol module.
- This action does not touch `alcohol_module_settings`.
- This action does not touch alcohol-related fields.
- AI cannot enable alcohol module.
- Partner/courier/admin cannot enable alcohol.
- Super admin cannot activate alcohol without legal review, licensing, and partner verification.
