# Stage 32-3 - Read-Only Adapter Hardening Implementation Decision

## Purpose

This document decides whether read-only adapter hardening should be implemented next and defines strict Stage 33 boundaries.

Goals:

- Decide if read-only adapter hardening should be implemented next.
- Define exact Stage 33 boundaries.
- Prevent writes, SQL, and migrations.
- Protect the current working read-only UI.

## Current State

- Stage 30 read-only UI implemented.
- Stage 31 manual QA documented.
- Stage 32 ownership/role hardening plans exist.
- `DATA_SOURCE_MODE=mock` default.
- `ALCOHOL_MODULE_ENABLED=false`.
- No writes.
- No SQL.

## Proposed Stage 33

Stage 33 - Partner/Admin Read-Only Adapter Ownership & Role Hardening Implementation.

Scope:

- Improve partner ownership resolution.
- Improve admin role safe states.
- Keep read-only behavior.
- Keep fallback behavior.
- Improve tests/docs.
- No writes.
- No SQL.
- No migration.

## Allowed In Stage 33

- Read-only adapter refactor.
- Safer `business_id` filtering.
- Safer auth/role missing states.
- Better fallback statuses.
- Better safe error messages.
- Better docs.
- Build fixes.

## Not Allowed In Stage 33

- Writes.
- Forms.
- Server actions that mutate.
- SQL.
- RLS policies.
- Schema changes.
- Database changes.
- Create/edit/delete.
- Approve/reject/publish/archive.
- `audit_logs` insert.
- Cart/checkout/payment/order/booking.
- Alcohol enablement.

## Go Criteria

Stage 33 can start if:

- Stage 32 PASS.
- Stage 31 PASS/PASS WITH NOTES or route retest risk is accepted and documented.
- `DATA_SOURCE_MODE=mock`.
- `ALCOHOL_MODULE_ENABLED=false`.
- Build passes.
- No pending route crash.
- No SQL required.
- Ownership model confirmed:
  - `partner_profiles.business_id = partners.id`
  - `catalog.business_id = partners.id`

## No-Go Criteria

Do not start Stage 33 if:

- Stage 31 route QA is incomplete and a browser retest is required before implementation.
- Auth role source requires schema migration first.
- Writes are requested.
- SQL/RLS needs to be applied first.
- Alcohol enablement is requested.
- Payment/order/booking features are mixed in.

## Stage 33 Suggested Sub-Stages

- 33-1 Partner Ownership Resolution Hardening
- 33-2 Admin Role Safe-State Hardening
- 33-3 Read-Only Route QA in Mock Mode
- 33-4 Read-Only Route QA in Supabase Mode
- 33-5 Final Audit

## Implementation Rules For Stage 33

- Keep all adapter functions read-only.
- All Supabase reads filtered safely.
- No raw errors returned to UI.
- No secrets.
- No service role in client components.
- Maintain timeout/fallback behavior.
- Keep `DATA_SOURCE_MODE=mock` default.

## Risk Decision Table

| Risk | Decision | Mitigation |
| --- | --- | --- |
| Auth helper incomplete | Proceed only if safe states can be returned. | Do not force auth; return documented missing state. |
| Admin role source missing | Proceed with safe `admin_role_source_missing` state. | Do not create schema in Stage 33. |
| Demo fallback data | Allow only with clear fallback label/status. | Avoid treating fallback as ownership proof. |
| Service role exposure | Hard block. | Server-only imports; no client component service role use. |
| Unfiltered partner query | Hard block. | Require resolved `business_id` filter. |
| Fallback masking real issue | Allow with explicit code/status. | Surface safe state in result. |
| Route crash from stricter auth | Hard block. | Preserve safe fallback/empty state behavior. |
| Accidental writes | Hard block. | No insert/update/delete/upsert/write RPC. |

## Final Decision

Recommend proceeding to:

Stage 33 - Partner/Admin Read-Only Adapter Ownership & Role Hardening Implementation.

Only read-only hardening is allowed.
