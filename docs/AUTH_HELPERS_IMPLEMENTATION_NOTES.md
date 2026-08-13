# Stage 12T-2 - Auth Helpers Implementation Notes

Project: KOL / Issyk-Kul Travel & Delivery Platform.

This stage implemented safe auth helper skeletons only. It did not protect routes, create middleware, wire UI to auth, create backend writes, connect buttons to real actions, or mutate mock data.

## Files Created Or Updated

- `src/lib/auth/types.ts`
- `src/lib/auth/errors.ts`
- `src/lib/auth/session.ts`
- `src/lib/auth/profile.ts`
- `src/lib/auth/roles.ts`
- `src/lib/auth/ownership.ts`
- `src/lib/auth/index.ts`
- `docs/AUTH_HELPERS_IMPLEMENTATION_NOTES.md`
- `README.md`

Existing demo auth files remain compatible:

- `src/lib/auth/demo-session.ts`
- `src/lib/auth/permissions.ts`

## Helper Behavior

The helpers are safe skeletons for future server-side auth:

- `getCurrentSession()`
- `requireAuthenticatedUser()`
- `getCurrentUserProfile()`
- `requireActiveProfile()`
- `requireRole(allowedRoles)`
- `requireClient()`
- `requirePartner()`
- `requireCourier()`
- `requireAdmin()`
- `requireSuperAdmin()`
- ownership helpers for partner, courier, and client records

Without real Supabase Auth and profile tables, helpers fail safely with structured errors. They do not require real env vars during mock builds.

## Safe Errors

Safe auth error codes:

- `not_authenticated`
- `not_authorized`
- `profile_not_found`
- `profile_inactive`
- `ownership_failed`
- `invalid_role`
- `invalid_target`
- `server_error`

Helpers must not expose raw Supabase errors, SQL details, auth tokens, service role keys, or private env values.

## Current Limitations

- Supabase Auth is not connected.
- Real session reading is not active.
- Real profile queries are not active.
- Real ownership queries are not active.
- Route protection is not active.
- Demo dashboards remain accessible.

## First Real Write Dependency

`markOrderReadyForPickupAction` later must use:

- `requirePartner()`
- `requirePartnerOrderOwnership(orderId)`
- audit helper
- status validation

The future action must still validate allowed status transitions and avoid payment, order item, courier, delivery completion, cancellation, refund, and alcohol-related changes.

## Security Notes

- Do not trust client-provided role.
- Do not trust client-provided `partner_id` or `courier_id`.
- Server actions must re-check auth, role, and ownership.
- Service role key must not be used in client code.
- RLS is still required when real Supabase is connected.

## Rollback Path

If future auth work breaks:

1. Do not enable route protection.
2. Keep `DATA_SOURCE_MODE=mock`.
3. Keep demo actions and mock data.
4. Run `npm run build`.
5. Restart the dev server.

## Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`.
- Auth helpers must not enable alcohol module.
- Auth roles cannot enable alcohol module.
- AI cannot enable alcohol module.
- Partner/courier/admin cannot enable alcohol.
- Super admin cannot activate alcohol without legal review, licensing, and partner verification.

