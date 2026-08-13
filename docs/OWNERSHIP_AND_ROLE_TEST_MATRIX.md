# Stage 32-4 - Ownership and Role Test Matrix

## Purpose

This matrix defines test cases before adapter hardening.

Goals:

- Prevent ownership leaks.
- Prevent non-admin access to global catalog data.
- Keep read-only behavior.

## Partner Ownership Test Matrix

| Test id | Scenario | Setup | Expected result | Safe status | No-write expectation | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| P-001 | Valid partner with profile and business | Auth user has partner profile and valid business_id. | Own records only. | `ownershipResolved=true` | No writes. | Filter by `business_id`. |
| P-002 | Partner profile missing | Auth user has no partner profile. | Safe denied/empty state. | `partner_profile_missing` | No writes. | No fallback leak. |
| P-003 | Partner profile has invalid business_id | Profile business_id does not match partner. | Safe denied/empty state. | `ownership_mismatch` | No writes. | No other records. |
| P-004 | Partner business missing | Profile references missing partner. | Safe denied/empty state. | `business_missing` | No writes. | No raw error. |
| P-005 | Partner business inactive | Business status inactive/suspended. | Safe denied/limited state. | `business_inactive` | No writes. | No operational controls. |
| P-006 | Catalog record belongs to another business | Other business records exist. | Not visible. | `ownershipResolved=true` | No writes. | Leak prevention. |
| P-007 | Partner route in mock mode | `DATA_SOURCE_MODE=mock`. | Mock data only. | `mock_mode` | No writes. | Clearly labeled. |
| P-008 | Partner route in Supabase mode | `DATA_SOURCE_MODE=supabase`. | Own records or safe state. | `supabase_success` or safe state | No writes. | Filtered query. |
| P-009 | Supabase unreachable fallback | Supabase unavailable. | Safe fallback. | `fallback_to_mock` or `server_error` | No writes. | No raw error. |
| P-010 | Product safety/alcohol-like item | Product has alcohol-like keyword. | Hidden or flagged safely. | safe flag status | No writes. | Alcohol remains disabled. |
| P-011 | Empty catalog | Partner has no records. | Empty state. | `empty_result` | No writes. | No crash. |
| P-012 | Raw error sanitized | Supabase returns error. | Safe message only. | `read_failed` | No writes. | No secrets. |

## Admin Role Test Matrix

| Test id | Scenario | Setup | Expected result | Safe status | No-write expectation | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| A-001 | Valid admin | Auth user has admin role. | Global read-only records. | `supabase_success` | No writes. | No mutation controls. |
| A-002 | Admin auth missing | No auth session. | Safe denied state. | `admin_auth_missing` | No writes. | No raw error. |
| A-003 | Admin role missing | Auth user is not admin. | Safe denied state. | `admin_role_missing` | No writes. | No global data. |
| A-004 | Admin role source missing | Role source not implemented. | Safe documented state. | `admin_role_source_missing` | No writes. | No schema in this stage. |
| A-005 | Partner user attempts admin route | Partner auth user opens admin route. | Safe denied state. | `admin_role_missing` | No writes. | No global data. |
| A-006 | Admin route in mock mode | `DATA_SOURCE_MODE=mock`. | Mock admin data. | `mock_mode` | No writes. | Clearly labeled. |
| A-007 | Admin route in Supabase mode | `DATA_SOURCE_MODE=supabase`. | Read-only records or safe state. | `supabase_success` or safe state | No writes. | Server-side role check later. |
| A-008 | Supabase unreachable fallback | Supabase unavailable. | Safe fallback. | `fallback_to_mock` or `server_error` | No writes. | No raw error. |
| A-009 | Safety page shows flags read-only | Safety flags exist. | Flags visible read-only. | safe flag state | No writes. | No override. |
| A-010 | Categories read-only | Categories exist. | Categories visible read-only. | `supabase_success` | No writes. | No category mutation UI. |
| A-011 | Raw error sanitized | Supabase returns error. | Safe message only. | `read_failed` | No writes. | No secrets. |
| A-012 | No service role in client | Inspect bundles/imports. | Service role server-only. | safe | No writes. | No client exposure. |

## Route Matrix

| Route | Mock expected state | Supabase expected state | Auth/ownership/role missing state | Fallback state |
| --- | --- | --- | --- | --- |
| `/partner/catalog` | Mock overview | Own business overview | Safe ownership state | Fallback to mock |
| `/partner/catalog/food` | Mock food | Own food records | Safe ownership state | Fallback to mock |
| `/partner/catalog/tours` | Mock tours | Own tour records | Safe ownership state | Fallback to mock |
| `/partner/catalog/stays` | Mock stays | Own stay records | Safe ownership state | Fallback to mock |
| `/partner/catalog/products` | Mock products | Own product records with safety flags | Safe ownership state | Fallback to mock |
| `/admin/catalog` | Mock admin overview | Global overview if admin | Safe admin role state | Fallback to mock |
| `/admin/catalog/review` | Mock review queue | Review queue if admin | Safe admin role state | Fallback to mock |
| `/admin/catalog/food` | Mock food | Global food if admin | Safe admin role state | Fallback to mock |
| `/admin/catalog/tours` | Mock tours | Global tours if admin | Safe admin role state | Fallback to mock |
| `/admin/catalog/stays` | Mock stays | Global stays if admin | Safe admin role state | Fallback to mock |
| `/admin/catalog/products` | Mock products | Global products if admin | Safe admin role state | Fallback to mock |
| `/admin/catalog/categories` | Mock categories | Categories if admin | Safe admin role state | Fallback to mock |
| `/admin/catalog/safety` | Mock safety flags | Safety flags if admin | Safe admin role state | Fallback to mock |

## No-Write Test Matrix

Tests must verify no:

- `insert`
- `update`
- `delete`
- `upsert`
- write `rpc`
- `audit_logs` insert
- `createOrder`
- `createBooking`
- `createCart`
- `createCheckout`
- `createPayment`
- `updateStock`
- `updateAvailability`

## Alcohol Test Matrix

| Test id | Scenario | Expected result |
| --- | --- | --- |
| AL-001 | `ALCOHOL_MODULE_ENABLED=false` | Alcohol remains disabled. |
| AL-002 | Alcohol item in product data | Hidden or flagged safely. |
| AL-003 | Admin safety page | No alcohol override UI. |
| AL-004 | Public/partner/admin catalog | No alcohol sales/delivery path. |
| AL-005 | Category handling | No alcohol category creation. |

## Environment Test Matrix

| Test id | Scenario | Expected result |
| --- | --- | --- |
| ENV-001 | `DATA_SOURCE_MODE=mock` | Mock mode works. |
| ENV-002 | Temporary `DATA_SOURCE_MODE=supabase` | Supabase read or safe fallback. |
| ENV-003 | Restore `DATA_SOURCE_MODE=mock` | Mock restored after test. |
| ENV-004 | Supabase env values | Presence confirmed without printing secrets. |
| ENV-005 | Final build | Build passes. |

## Decision

This matrix should be used in Stage 33 QA.
