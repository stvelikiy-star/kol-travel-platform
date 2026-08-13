# Stage 32-2 - Admin Catalog Read-Only Role Hardening Plan

## Purpose

This plan defines how admin read-only role checks should be hardened before any future admin writes or moderation implementation.

Goals:

- Harden admin read-only access before moderation writes.
- Prevent non-admin access to global catalog visibility.
- Prepare future RLS/write implementation.
- Keep admin catalog screens read-only.

## Current Admin Read-Only Scope

Admin routes:

- `/admin/catalog`
- `/admin/catalog/review`
- `/admin/catalog/food`
- `/admin/catalog/tours`
- `/admin/catalog/stays`
- `/admin/catalog/products`
- `/admin/catalog/categories`
- `/admin/catalog/safety`

Current behavior is read-only and must remain read-only.

## Admin Role Model

Future admin role sources:

- Auth user id.
- Admin profile/role source if available.
- Server-side role check.
- Super admin later if needed.

Current limitation:

- Admin role hardening requires an explicit role source before production.
- No SQL in this stage.
- No schema change in this stage.

## Admin Access Flow

Future hardened flow:

1. Resolve current authenticated user.
2. Verify admin role server-side.
3. If admin role is missing, return safe `admin_role_missing` state.
4. If admin role is confirmed, read all catalog records read-only.
5. Return safe data without secrets or raw errors.

## Failure States

- `admin_auth_missing`
- `admin_role_missing`
- `admin_role_source_missing`
- `read_failed`
- `empty_result`
- `fallback_to_mock`
- `server_error`

## Admin Route Behavior

Each admin catalog route must document:

- Role requirement.
- Safe fallback state.
- No mutation capability.
- No raw error exposure.
- No secret exposure.

## Read Adapter Requirements

Future admin adapter hardening should ensure:

- Admin checks are server-side.
- Service role remains server-only.
- Client components do not import service-role clients.
- No raw Supabase errors in UI.
- No writes.
- Safe timeout/fallback behavior.

## Safety Moderation Visibility

Admin read-only safety page may show:

- Safety flags.
- Suspicious products.
- Alcohol-like keyword matches.
- Missing category/price.
- Invalid status.
- Inactive business.

Admin read-only safety page must not:

- Approve.
- Reject.
- Publish.
- Archive.
- Override alcohol safety.
- Enable alcohol.

## Security Risk Table

| Risk | Impact | Mitigation | Stage to address |
| --- | --- | --- | --- |
| Admin role source missing | Cannot verify admin access. | Define role source before production. | Stage 33 |
| Non-admin accessing admin routes | Global catalog exposure. | Server-side role checks and safe denied state. | Stage 33 |
| Service role exposed client-side | Critical secret leak. | Keep service role server-only. | Stage 33 |
| Global catalog data shown to partner | Cross-role data leak. | Separate partner and admin read paths. | Stage 33 |
| Raw error leakage | Secrets/schema details may leak. | Safe error codes/messages only. | Stage 33 |
| Fallback masking admin-role issue | QA may miss auth failure. | Return explicit role/fallback status. | Stage 33 |
| Unsafe product override path | Alcohol/product safety bypass. | Keep safety page read-only. | Stage 33 |
| Accidental mutation button | Unauthorized moderation action. | Do not add mutation controls in read-only route. | Stage 33 |

## Test Requirements

Future hardening implementation should test:

- Admin sees global read-only records.
- Non-admin sees safe denied state.
- Missing admin role source is documented.
- No writes.
- No mutation UI.
- Safety panel is read-only.
- No alcohol override.

## No-Write / No-SQL Guarantee

This stage is docs only:

- No code.
- No SQL.
- No DB changes.
- No RLS policies.
- No writes.

## Alcohol Safety

- `ALCOHOL_MODULE_ENABLED=false`
- Admin role hardening must not enable alcohol.
- No alcohol override controls.
- Alcohol activation remains a separate legal/super-admin workflow.
