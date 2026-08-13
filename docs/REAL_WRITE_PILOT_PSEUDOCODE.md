# Real Write Pilot Pseudocode

Stage: 12L-3 - Real Write Pilot Pseudocode.

Selected future pilot:

- `markOrderReadyForPickupAction(orderId)`

Current demo action:

- `markOrderReadyForPickupDemoAction(orderId)`

This document is pseudocode only. Do not implement the real write yet, do not connect Supabase, do not mutate mock data, and do not create a real server action in this stage.

`DATA_SOURCE_MODE=mock` remains the default. `ALCOHOL_MODULE_ENABLED=false` by default. Alcohol sales and delivery are disabled.

## 1. Goal

- Define safe pseudocode before real implementation.
- Keep first write small and controlled.
- Protect payment/cancellation/delivery state.
- Require role/ownership/audit logic.
- Preserve rollback to demo/mock mode.

## 2. Future Function Name

```ts
markOrderReadyForPickupAction(orderId: string)
```

## 3. Future Input

- `orderId: string`

## 4. Future Output

Use a safe result shape similar to:

```ts
{
  ok: boolean,
  mode: "real",
  action: "mark_order_ready_for_pickup",
  message: string,
  riskLevel: "medium",
  auditRequired: true,
  humanApprovalRequired: false
}
```

## 5. Pseudocode

### Step 1: Validate Input

- `orderId` exists.
- `orderId` is string.
- `orderId` is not empty.

If invalid, return a safe user-facing error.

### Step 2: Get Authenticated Session

- Load authenticated session.
- If no session, return safe error.

### Step 3: Load User Profile

- Verify role = `partner`.
- Get `partner_id`.
- If no `partner_id`, return safe error.

### Step 4: Load Order

- Select order by `orderId`.
- Include `partner_id`, `status`, `payment_status`, `cancelled_at`, `refunded_at`.
- Include `delivery_status` if it exists directly on the order.
- If not found, return safe error.
- If `order.partner_id !== user.partner_id`, return safe error.

### Step 5: Validate Status Transition

Allowed current statuses:

- `accepted_by_partner`
- `preparing`

Blocked statuses:

- `new_order`
- `rejected`
- `cancelled`
- `picked_up`
- `courier_to_client`
- `delivered`
- `refunded`
- `admin_required`

If blocked:

- Return safe error.
- Do not update.

### Step 6: Safety Checks

The action must not:

- Change `payment_status`.
- Change price.
- Change order items.
- Assign courier.
- Mark `picked_up`.
- Mark `delivered`.
- Refund.
- Cancel.
- Enable alcohol module.

### Step 7: Prepare Before State

Capture:

- order id;
- status;
- `payment_status`;
- `delivery_status` if exists;
- `updated_at`.

### Step 8: Update Order

Update only:

- `status = ready_for_pickup`
- `ready_for_pickup_at = now()`
- `updated_at = now()`

Do not change payment, refund, courier assignment or delivery completion fields.

### Step 9: Prepare After State

Capture updated fields:

- order id;
- status;
- `ready_for_pickup_at`;
- `payment_status`;
- `delivery_status` if exists;
- `updated_at`.

### Step 10: Create Audit Log

Create audit log:

- `actor_user_id`
- `actor_role = partner`
- `action_type = mark_order_ready_for_pickup`
- `target_table = orders`
- `target_id = orderId`
- `before_state`
- `after_state`
- `risk_level = medium`
- `human_approval_required = false`
- `created_at`

### Step 11: Return Success

Return:

```ts
{
  ok: true,
  mode: "real",
  action: "mark_order_ready_for_pickup",
  message: "Заказ отмечен как готовый к выдаче. Следующий этап - назначение/ожидание курьера.",
  riskLevel: "medium",
  auditRequired: true,
  humanApprovalRequired: false
}
```

### Step 12: Error Handling

- Return safe user-facing error.
- Never expose raw Supabase error.
- Never expose service role key.
- Log server error later if needed.

## 6. Transaction Note

Real implementation should ideally use:

- database transaction / RPC function; or
- safe server-side sequence with rollback handling.

The order update and audit log should be consistent. If the order update succeeds but audit log creation fails, the implementation must avoid leaving an unaudited sensitive transition.

## 7. RLS/Auth Note

- Server action must enforce role and ownership even if RLS exists.
- RLS must also enforce safety.
- Never rely only on client-side checks.
- Never rely only on UI button visibility.

## 8. UI Note

Future UI:

- Button: "Готов к выдаче".
- Success message.
- Next step: "Ожидает курьера".
- No wording about payment.
- No real courier assignment from this action.
- No implication that delivery was picked up or completed.

## 9. Rollback

If implementation fails:

- Keep demo action.
- Keep `DATA_SOURCE_MODE=mock`.
- Revert button to demo pilot.
- Run `npm run build`.
- Verify `/partner/orders`.
- Do not delete mock data.

## 10. Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`.
- Alcohol sales and delivery are disabled.
- Action must not enable alcohol module.
- AI cannot enable alcohol module.
- Partner, courier and admin cannot enable alcohol.
- Future activation requires legal review, licensing, partner verification and `super_admin` approval.
- Alcohol-related request is critical risk.

## 11. Next Stages

Recommended next stages:

1. `12L-4 Real Write Pilot Test Plan`
2. `12M Auth + Role Implementation Plan`
3. `12N Audit Log Implementation Plan`
4. `12O First Real Write Implementation`
