# Role Helper Pseudocode

Stage: 12M-3 - Role Helper Pseudocode.

This document defines future server-side role helper logic. Do not implement auth helpers yet, do not connect Supabase Auth, do not create middleware, and do not change UI behavior in this stage.

`DATA_SOURCE_MODE=mock` remains the default. `ALCOHOL_MODULE_ENABLED=false` by default. Alcohol sales and delivery are disabled.

## 1. Goal

- Define future server-side role helper logic.
- Prevent unsafe real write actions.
- Prepare for protected routes and ownership checks.
- Keep implementation predictable before coding.
- Make server actions independent from client-side role assumptions.

## 2. Future Helper Groups

### Auth/Session

- `getCurrentSession()`
- `getCurrentUserProfile()`
- `requireAuthenticatedUser()`

### Role

- `requireRole(allowedRoles)`
- `requireClient()`
- `requirePartner()`
- `requireCourier()`
- `requireAdmin()`
- `requireSuperAdmin()`

### Ownership

- `requirePartnerOwnership(partnerId)`
- `requirePartnerOrderOwnership(orderId)`
- `requirePartnerBookingOwnership(bookingId)`
- `requirePartnerCatalogOwnership(itemId)`
- `requireCourierDeliveryAccess(deliveryId)`
- `requireClientOrderOwnership(orderId)`

### Admin/High-Risk

- `requireAdminForHighRiskAction()`
- `requireReasonForHighRiskAction(reason)`
- `requireAuditLogForAction(actionType)`
- `requireSuperAdminForPlatformSettings()`

### AI Dispatcher

- `requireServerOnlyAiDispatcher()`
- `preventAiHighRiskExecution(actionType)`

## 3. Pseudocode For requireAuthenticatedUser

```ts
async function requireAuthenticatedUser() {
  const session = await getCurrentSession()

  if (!session?.user?.id) {
    return safeError("not_authenticated", "Нужно войти в аккаунт.")
  }

  const profile = await getCurrentUserProfile(session.user.id)

  if (!profile) {
    return safeError("not_authorized", "Профиль пользователя не найден.")
  }

  return { ok: true, session, profile }
}
```

Rules:

- Read server session.
- If no session, return safe error.
- Load profile.
- If no profile, return safe error.
- Return user/profile.

## 4. Pseudocode For requireRole

```ts
async function requireRole(allowedRoles: string[]) {
  const auth = await requireAuthenticatedUser()

  if (!auth.ok) {
    return auth
  }

  if (!allowedRoles.includes(auth.profile.role)) {
    return safeError("not_authorized", "Недостаточно прав для этого действия.")
  }

  return auth
}
```

Rules:

- Call `requireAuthenticatedUser`.
- Check `profile.role` in `allowedRoles`.
- If not allowed, return not authorized safe error.
- Never rely on client-side role only.

## 5. Pseudocode For Partner Ownership

```ts
async function requirePartnerOrderOwnership(orderId: string) {
  const auth = await requireRole(["partner"])

  if (!auth.ok) {
    return auth
  }

  const partnerId = auth.profile.partner_id

  if (!partnerId) {
    return safeError("not_authorized", "Партнёрский профиль не найден.")
  }

  const order = await loadOrderById(orderId)

  if (!order || order.partner_id !== partnerId) {
    return safeError("not_found", "Запись не найдена или недоступна.")
  }

  return { ok: true, auth, order }
}
```

Rules:

- Require role `partner`.
- Load partner profile relation.
- Load target record.
- Compare `target.partner_id` with `profile.partner_id`.
- If mismatch, return safe error.
- Do not expose whether another partner record exists.

## 6. Pseudocode For Courier Delivery Access

```ts
async function requireCourierDeliveryAccess(deliveryId: string) {
  const auth = await requireRole(["courier"])

  if (!auth.ok) {
    return auth
  }

  const courierId = auth.profile.courier_id

  if (!courierId) {
    return safeError("not_authorized", "Профиль курьера не найден.")
  }

  const delivery = await loadDeliveryById(deliveryId)

  if (!delivery) {
    return safeError("not_found", "Доставка не найдена или недоступна.")
  }

  const assignedToCourier = delivery.courier_id === courierId
  const availableForAcceptance =
    delivery.status === "delivery_pending" && delivery.courier_id === null

  if (!assignedToCourier && !availableForAcceptance) {
    return safeError("not_authorized", "Доставка недоступна для этого курьера.")
  }

  return { ok: true, auth, delivery }
}
```

Rules:

- Require role `courier`.
- Load courier profile relation.
- Load delivery.
- Allow only if delivery `courier_id` equals current `courier_id`, or delivery is available and business rules allow acceptance.
- Block access to other courier private deliveries.

## 7. Pseudocode For Admin High-Risk

```ts
async function requireAdminForHighRiskAction(reason: string, riskLevel: string) {
  const auth = await requireRole(["admin", "super_admin"])

  if (!auth.ok) {
    return auth
  }

  if (!reason || reason.trim().length < 5) {
    return safeError("high_risk_requires_approval", "Укажите причину действия.")
  }

  if (riskLevel === "critical" && auth.profile.role !== "super_admin") {
    return safeError(
      "high_risk_requires_approval",
      "Критическое действие требует усиленного подтверждения."
    )
  }

  return { ok: true, auth, reason }
}
```

Rules:

- Require role `admin` or `super_admin`.
- Require reason.
- Classify risk.
- If critical, require stronger approval flow later.
- Create audit log later.
- Never bypass legal/compliance requirements.

## 8. Pseudocode For AI Dispatcher Safety

```ts
function preventAiHighRiskExecution(actionType: string) {
  const blockedPatterns = [
    "cancel",
    "payment",
    "refund",
    "block",
    "unblock",
    "force",
    "alcohol",
  ]

  const blocked = blockedPatterns.some((pattern) =>
    actionType.toLowerCase().includes(pattern)
  )

  if (blocked) {
    return {
      ok: false,
      code: "high_risk_requires_approval",
      message: "AI может только рекомендовать это действие. Требуется админ.",
      shouldCreateSafetyRefusalLog: true,
      shouldAlertAdmin: true,
    }
  }

  return { ok: true }
}
```

Rules:

- AI role is server-only.
- AI can recommend/alert/log.
- AI cannot execute high-risk actions.
- If requested action is cancel/payment/refund/block/force/alcohol:
  - refuse execution;
  - create safety refusal log later;
  - alert admin if needed.

## 9. Safe Error Shape

Future safe error response:

```ts
{
  ok: false,
  code:
    | "not_authenticated"
    | "not_authorized"
    | "not_found"
    | "invalid_transition"
    | "high_risk_requires_approval"
    | "server_error",
  message: string
}
```

No raw Supabase/auth errors should be shown in UI.

## 10. Server-Only Rules

- Service role key only server-side.
- No service role in client components.
- Helpers used in server actions.
- Helpers used in protected server layouts later.
- RLS still required even with helpers.
- Client UI may hide buttons, but server helpers are the real enforcement layer.

## 11. Rollback

- Keep demo mode.
- Keep `DATA_SOURCE_MODE=mock`.
- Do not enforce helpers before auth test users exist.
- Do not delete mock data.
- Do not remove demo actions.
- Disable unfinished protected-route enforcement in local demo branch if needed.

## 12. Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`.
- Alcohol sales and delivery are disabled.
- Helpers must not enable alcohol module.
- AI cannot enable alcohol module.
- Partner, courier and admin cannot enable alcohol.
- `super_admin` cannot activate alcohol without legal review, licensing and partner verification.
- Alcohol-related request is critical risk.

## 13. Next Stages

Recommended next stages:

1. `12M-4 Auth Test User Plan`
2. `12N-1 Audit Log Implementation Plan`
3. `12O-1 First Real Write Implementation Preparation`
