# Stage 12R-2 - First Real Write Readiness Gate

Project: KOL / Issyk-Kul Travel & Delivery Platform.

This document is a readiness gate before implementing the first real backend write. It does not implement the real action, connect Supabase, create backend writes, wire UI to a real action, or mutate mock data.

Selected future real action:

- `markOrderReadyForPickupAction(orderId)`

Current demo fallback:

- `markOrderReadyForPickupDemoAction(orderId)`

## 1. Goal

- Decide whether the project is ready for the first real write implementation.
- Prevent unsafe implementation before Auth, Supabase, RLS, ownership checks, and Audit are ready.
- Keep the demo action stable.
- Protect against accidental real database mutation.

## 2. First Real Write Candidate

- Action: `markOrderReadyForPickupAction(orderId)`
- Role: `partner`
- Risk level: `medium`
- Audit required: yes
- Human approval required: no in the normal case
- Target table: `orders`
- Target status: `ready_for_pickup`

## 3. Current Fallback

- `markOrderReadyForPickupDemoAction(orderId)` must remain available.
- It must remain safe.
- It must not mutate mock data.
- It must remain connected until the real action is fully tested.

## 4. Required Dependency Checklist

| Dependency | Ready | Not Ready | Unknown | Notes |
| --- | --- | --- | --- | --- |
| Supabase test project exists |  |  | Yes | Must be confirmed outside this repo. |
| Supabase local/env setup confirmed |  |  | Yes | Real env is not required in the current mock build. |
| SQL schema applied |  |  | Yes | Must be confirmed in the test project. |
| RLS policies applied |  |  | Yes | Must be verified before writes. |
| Seed data applied |  |  | Yes | Must be verified before app connection. |
| Test users created |  |  | Yes | Future manual Supabase step. |
| `partner@test.kol` exists |  |  | Yes | Future test user requirement. |
| Partner profile linked to `partner_id` |  |  | Yes | Ownership depends on this. |
| Test order exists |  |  | Yes | Must use safe demo/test data only. |
| Test order belongs to test partner |  |  | Yes | Required for ownership validation. |
| Supabase server client exists |  | Yes |  | Safe placeholders exist, but real server client readiness is not confirmed. |
| Auth helpers implemented |  | Yes |  | Auth planning exists; real helpers are not implemented. |
| Role helpers implemented |  | Yes |  | Role planning exists; real helpers are not implemented. |
| Ownership helpers implemented |  | Yes |  | Ownership planning exists; real helper is not implemented. |
| Audit helper implemented |  | Yes |  | Audit helper is planned only. |
| `audit_logs` table exists |  |  | Yes | Must be confirmed after SQL application. |
| Audit insert tested |  | Yes |  | No real audit writes are active. |
| Rollback to mock mode confirmed | Yes |  |  | `DATA_SOURCE_MODE=mock` remains the default plan. |
| Build passes | Yes |  |  | Must be re-run after every implementation step. |

## 5. Hard Blocker Rule

If any of these are not ready, do not implement the real write:

- Supabase test project
- SQL schema
- RLS
- test partner user/profile
- test partner order
- auth helper
- partner role helper
- partner order ownership helper
- audit helper
- rollback path

Current gate result: hard blockers remain.

## 6. Implementation Decision

This stage must not inspect external Supabase directly. Actual readiness must be confirmed manually before implementation.

- Ready for real implementation: no
- Reason: required Supabase/Auth/RLS/Audit/Ownership dependencies are not confirmed or not implemented.
- If unknown or no, continue with dependency implementation stages first.

## 7. Safe Implementation Condition

Only proceed to real implementation when all are true:

- `DATA_SOURCE_MODE` can safely switch to Supabase/test mode.
- Auth test user can login.
- Partner ownership can be verified.
- Order status values are confirmed.
- Audit log can be inserted.
- Rollback to demo action is clear.

## 8. What Must Not Happen

The next implementation must not:

- skip auth;
- skip ownership;
- skip audit;
- update `payment_status`;
- update order price;
- update order items;
- assign courier;
- mark `picked_up`;
- mark `delivered`;
- cancel order;
- refund order;
- enable alcohol module.

## 9. If Dependencies Are Missing

Recommended next stages:

- implement Supabase server client readiness;
- implement auth helpers;
- implement audit helper;
- create/test Supabase users;
- verify RLS and seed data;
- then return to first real write.

## 10. If Dependencies Are Ready

Recommended next stage:

- Stage 12R-3 - `markOrderReadyForPickupAction` Implementation Prompt

This path is not currently approved by this readiness gate.

## 11. Rollback Readiness

Rollback plan:

- keep demo action;
- keep `DATA_SOURCE_MODE=mock` as default;
- do not remove mock data;
- do not remove demo UI wiring;
- if real action fails, disconnect real action and return to demo;
- run `npm run build`.

## 12. Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`.
- Alcohol sales/delivery disabled.
- This action must not enable alcohol module.
- This action must not touch alcohol-related fields.
- AI cannot enable alcohol module.
- Partner/courier/admin cannot enable alcohol.
- Super admin cannot activate alcohol without legal review, licensing, and partner verification.
- Alcohol-related request is critical risk.

## 13. Final Status

- Supabase readiness: unknown
- Auth readiness: not ready
- Ownership readiness: not ready
- Audit readiness: not ready
- RLS readiness: unknown
- Demo rollback readiness: ready
- Final decision: do not proceed; manual confirmation and dependency implementation required

## 14. Next Stages

If not ready:

- Stage 12S-1 - Supabase Server Client Readiness
- Stage 12S-2 - Auth Helper Implementation
- Stage 12S-3 - Audit Helper Implementation
- Stage 12S-4 - Test Users + RLS Verification

If ready later:

- Stage 12R-3 - `markOrderReadyForPickupAction` Implementation Prompt

