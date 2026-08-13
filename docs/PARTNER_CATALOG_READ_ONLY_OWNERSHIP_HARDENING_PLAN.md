# Stage 32-1 - Partner Catalog Read-Only Ownership Hardening Plan

## Purpose

This plan defines how partner catalog ownership behavior should be hardened before any future write implementation.

Goals:

- Harden partner ownership behavior before writes.
- Ensure partner read-only routes never expose another business data.
- Prepare future RLS/write implementation.
- Protect the current read-only UI.
- Keep no-write/no-SQL safety.

## Current Ownership Model

Future hardened partner reads should use:

- Auth user id.
- `partner_profiles.user_id`.
- `partner_profiles.business_id`.
- `partners.id`.
- `catalog.business_id`.

Canonical relationship:

- `partner_profiles.business_id = partners.id`
- `catalog.business_id = partners.id`

Do not introduce or rely on `partner_id`.

## Demo / Test Ownership Context

Reference IDs for test planning only:

- Partner auth user: `00000000-0000-0000-0000-000000000003`
- Demo partner business: `20000000-0000-0000-0000-000000000001`
- Partner profile: `30000000-0000-0000-0000-000000000003`

If code does not directly use these IDs, they remain manual test references only.

## Ownership Resolution Flow

Future hardened flow:

1. Resolve current authenticated user.
2. Find `partner_profiles` where `user_id = auth user id`.
3. Resolve `business_id` from `partner_profiles.business_id`.
4. Verify `partners.id = business_id` and partner status/business status is safe.
5. Read catalog records only where `catalog.business_id = business_id`.
6. Return safe result:
   - `ownershipResolved: true | false`
   - `businessId` only if safe
   - `businessTitle` only if safe
   - records filtered by `business_id` only

## Failure States

Safe states:

- `auth_missing`
- `partner_profile_missing`
- `business_missing`
- `business_inactive`
- `ownership_mismatch`
- `read_failed`
- `empty_result`
- `fallback_to_mock`
- `server_error`

No raw Supabase errors. No secrets.

## Partner Route Behavior

Routes:

- `/partner/catalog`
- `/partner/catalog/food`
- `/partner/catalog/tours`
- `/partner/catalog/stays`
- `/partner/catalog/products`

Each route must:

- Require partner business context.
- Show safe fallback if ownership cannot be resolved.
- Not display another business data.
- Remain read-only.

## Read Adapter Requirements

Future adapter hardening should ensure:

- All Supabase queries are filtered by resolved `business_id`.
- No unfiltered catalog reads for partner pages.
- No use of `partner_id`.
- No client-side service role.
- No secret exposure.
- Safe timeout/fallback behavior.

## Security Risk Table

| Risk | Impact | Mitigation | Stage to address |
| --- | --- | --- | --- |
| Missing auth helper | Partner identity cannot be trusted. | Require server-side auth/profile resolution before production. | Stage 33 |
| Demo fallback accidentally showing data | User may see mock data when ownership fails. | Label fallback clearly and avoid using fallback as proof of ownership. | Stage 33 |
| Partner profile missing | Partner route cannot resolve business. | Return `partner_profile_missing` safe state. | Stage 33 |
| `business_id` mismatch | Cross-business data leak. | Filter by resolved `business_id` only. | Stage 33 |
| Inactive business still visible | Suspended business may appear operational. | Check partner/business status before read. | Stage 33 |
| Unfiltered query | Global catalog leak to partner. | Prohibit unfiltered partner catalog Supabase reads. | Stage 33 |
| Raw error exposure | Secrets/schema details may leak. | Use safe error codes/messages only. | Stage 33 |
| Service role imported into client component | Critical secret exposure. | Keep service role server-only. | Stage 33 |
| Fallback masking ownership problem | QA may miss ownership failure. | Return explicit fallback/ownership status. | Stage 33 |

## Test Requirements

Future hardening implementation should test:

- Valid partner sees own records.
- Partner with missing profile sees safe state.
- Partner with wrong `business_id` sees no records.
- Partner cannot see another business records.
- Fallback does not leak data.
- Product/alcohol safety remains active.
- No writes.

## No-Write / No-SQL Guarantee

This stage is docs only:

- No code.
- No SQL.
- No DB changes.
- No RLS policies.
- No writes.

## Alcohol Safety

- `ALCOHOL_MODULE_ENABLED=false`
- Ownership hardening must not enable alcohol.
- Product safety filtering/flags remain active.
- No alcohol sales/delivery path.

## Recommended Next Stages

- 32-2 Admin Read-Only Role Hardening Plan
- 32-3 Read-Only Adapter Hardening Implementation Decision
- 32-4 Ownership/Auth Test Matrix
- 32-5 Stage 32 Final Audit
