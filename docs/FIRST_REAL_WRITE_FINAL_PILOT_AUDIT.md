# Stage 12R-7 - First Real Write Final Pilot Audit

## Audit Scope

Final audit target:

- `markOrderReadyForPickupAction(orderId)`
- `markOrderReadyForPickupDemoAction(orderId)`
- `/partner/orders` ready-for-pickup pilot wiring
- audit log behavior
- rollback path

This audit does not add actions, wire more buttons, protect routes, create login UI, change payments, change delivery completion, mutate mock data or enable alcohol module.

## Implementation Status

Confirmed:

- `markOrderReadyForPickupAction(orderId)` exists.
- `markOrderReadyForPickupDemoAction(orderId)` still exists.
- Demo action was not removed.
- Real action is not wired broadly.
- Only one controlled UI pilot exists on `/partner/orders`.
- Demo fallback remains available through `PartnerOrdersDemoActions`.

## Business Safety

The real action is limited to this transition:

- `preparing` or `accepted_by_partner` to `ready_for_pickup`

The action updates:

- `orders.status = ready_for_pickup`
- `orders.updated_at = now()`

The action does not currently update `ready_for_pickup_at`. This is acceptable for the current schema-specific pilot because the column must be confirmed before writing it. Add it only in a later scoped stage if the column exists.

The action does not update:

- `payment_status`
- `subtotal`
- `delivery_fee`
- `discount`
- `total`
- order items
- `client_id`
- `business_id`
- courier fields
- `picked_up`
- `delivered`
- cancelled fields
- refunded fields
- `alcohol_module_settings`

## Schema-Specific Ownership

Confirmed current schema ownership uses `business_id`, not `partner_id`.

The action reads:

- `partner_profiles.user_id`
- `partner_profiles.business_id`
- `orders.business_id`

Ownership check:

- selected partner profile `business_id` must equal selected order `business_id`

This matches `supabase/schema/001_initial_schema.sql`, where `partner_profiles.business_id` references `public.partners(id)` and `orders.business_id` references `public.partners(id)`.

## Safe Errors

Implemented safe result codes:

- `invalid_order_id`
- `profile_not_found`
- `ownership_failed`
- `order_not_found`
- `invalid_status_transition`
- `database_update_failed`
- `audit_insert_failed`
- `server_error`

Future auth codes are documented but not currently emitted by this pilot because real auth is not wired yet:

- `not_authenticated`
- `not_authorized`

The action catches unexpected errors and returns safe messages. It must never expose:

- raw Supabase error
- SQL details
- service role key
- auth token
- private env values

## Audit Behavior

If the update succeeds, the action attempts to create an audit row.

Current schema-specific audit fields:

- `actor_role = partner`
- `action = mark_order_ready_for_pickup`
- `entity_type = orders`
- `entity_id = orderId`
- `before`
- `after`
- `reason`
- `request_id`

Safe before/after state includes only:

- `id`
- `business_id`
- `status`
- `payment_status`
- `updated_at`

Planned normalized audit semantics:

- actorRole: `partner`
- actionType: `mark_order_ready_for_pickup`
- targetTable: `orders`
- targetId: `orderId`
- riskLevel: `medium`
- humanApprovalRequired: `false`

Manual verification required: the current SQL schema stores audit action and target as `action`, `entity_type` and `entity_id`. It does not currently store dedicated `risk_level` or `human_approval_required` columns on `audit_logs`. That is acceptable for the pilot, but production audit schema should be aligned before expanding real writes.

## UI Pilot Behavior

Confirmed on code inspection:

- `/partner/orders` includes the controlled pilot card.
- The real test button is labeled `Готов к выдаче — real test`.
- The pilot targets one seeded test order.
- The real action is gated by `DATA_SOURCE_MODE=supabase`.
- In `DATA_SOURCE_MODE=mock`, the button is disabled.
- The server action also blocks execution unless `DATA_SOURCE_MODE=supabase`.
- Demo fallback remains available.
- Result display uses `DemoActionResultPanel`.
- Result panel supports real pilot mode, role, risk level, safe code, audit warning and `auditLogId`.
- No unrelated actions were wired.

## Manual QA Docs

Confirmed docs exist:

- `docs/FIRST_REAL_WRITE_IMPLEMENTATION_NOTES.md`
- `docs/FIRST_REAL_WRITE_UI_WIRING_NOTES.md`
- `docs/FIRST_REAL_WRITE_QA.md`
- `docs/FIRST_REAL_WRITE_ROLLBACK_CHECK.md`

## Rollback Readiness

Confirmed:

- `DATA_SOURCE_MODE=mock` remains the default safe mode.
- Demo action remains available.
- UI can be reverted by removing only the real pilot card/button.
- Build passes in mock mode.
- Test order can be reset manually.

Rollback SQL:

```sql
update public.orders
set
  status = 'preparing',
  updated_at = now()
where
  business_id = '20000000-0000-0000-0000-000000000001'
  and status = 'ready_for_pickup';
```

Audit logs should not be deleted by default because they are evidence of testing.

## Manual Supabase Test State

Expected manual test state:

- `.env.local` exists locally only and is not committed.
- `DATA_SOURCE_MODE=mock` by default.
- `ALCOHOL_MODULE_ENABLED=false`.
- SQL `001_initial_schema.sql` applied.
- SQL `002_rls_policies_draft.sql` applied.
- SQL `003_seed_demo_data_draft_FIXED.sql` applied.
- `partner_profiles` has demo partner profile.
- `orders` has a demo order with `business_id` matching the partner profile.
- Test order can be `preparing` before test and `ready_for_pickup` after test.
- `audit_logs` exists.

Manual Supabase click/test is still required before treating the pilot as fully validated against a live test project.

## Alcohol Compliance

Confirmed:

- `ALCOHOL_MODULE_ENABLED=false`
- Alcohol sales and delivery remain disabled.
- Real action does not touch `alcohol_module_settings`.
- UI does not enable alcohol module.
- Audit helper does not enable alcohol module.
- AI cannot enable alcohol module.
- Partner, courier and admin cannot enable alcohol.
- Super admin cannot activate alcohol without legal review, licensing and partner verification.

## Final Decision

| Area | Decision | Notes |
| --- | --- | --- |
| Real action implementation | Pass with manual verification required | Code is scoped and schema-aware; live Supabase test still required. |
| UI pilot wiring | Pass | Single gated button only; demo fallback remains. |
| Audit behavior | Needs manual verification | Insert matches current schema; normalized risk fields are future schema work. |
| Rollback path | Pass | Mock mode fallback and reset SQL are documented. |
| Business safety | Pass | No payment, totals, courier, cancellation, refund or alcohol fields are patched. |
| Ready for next real action | Manual confirmation required | Complete one live TEST-project click and verify SQL/audit results first. |

## Recommended Next Stage

Recommended next stage:

- Stage 12V-1 - Supabase Read Mode Pilot Plan

Alternative after manual confirmation:

- Stage 12T-6 - Partner Order Actions Expansion Plan

Do not expand real writes until the first pilot is manually verified in the Supabase TEST project.
