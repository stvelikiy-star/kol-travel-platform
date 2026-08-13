# Stage 33-6 - Ownership/Role Hardening Manual Route Retest

## Method

Local route rendering was tested with a dev server in both modes:

- `DATA_SOURCE_MODE=mock`
- temporary `DATA_SOURCE_MODE=supabase`

The in-app browser connection was attempted but did not remain available for the full test. The reliable retest evidence below comes from local HTTP route rendering against the dev server.

## Mock Mode Route Retest

Setup:

- `DATA_SOURCE_MODE=mock`
- `ALCOHOL_MODULE_ENABLED=false`
- Dev server ready: yes

| Route | Status | Mode badge | Read-only label | Forms | Buttons | Catalog mutation controls | Secrets/raw env |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/partner/catalog` | 200 | Mock data mode | yes | 0 | 6 inherited demo guide buttons | no | no |
| `/partner/catalog/food` | 200 | Mock data mode | yes | 0 | 6 inherited demo guide buttons | no | no |
| `/partner/catalog/tours` | 200 | Mock data mode | yes | 0 | 6 inherited demo guide buttons | no | no |
| `/partner/catalog/stays` | 200 | Mock data mode | yes | 0 | 6 inherited demo guide buttons | no | no |
| `/partner/catalog/products` | 200 | Mock data mode | yes | 0 | 6 inherited demo guide buttons | no | no |
| `/admin/catalog` | 200 | Mock data mode | yes | 0 | 0 | no | no |
| `/admin/catalog/review` | 200 | Mock data mode | yes | 0 | 0 | no | no |
| `/admin/catalog/food` | 200 | Mock data mode | yes | 0 | 0 | no | no |
| `/admin/catalog/tours` | 200 | Mock data mode | yes | 0 | 0 | no | no |
| `/admin/catalog/stays` | 200 | Mock data mode | yes | 0 | 0 | no | no |
| `/admin/catalog/products` | 200 | Mock data mode | yes | 0 | 0 | no | no |
| `/admin/catalog/categories` | 200 | Mock data mode | yes | 0 | 0 | no | no |
| `/admin/catalog/safety` | 200 | Mock data mode | yes | 0 | 0 | no | no |

Note: Partner pages inherit existing partner layout demo guide buttons such as `Принять заказ demo` and `Отклонить demo`. These are not catalog mutation controls and were not introduced by Stage 33.

## Supabase Mode Route Retest

Setup:

- temporary `DATA_SOURCE_MODE=supabase`
- `ALCOHOL_MODULE_ENABLED=false`
- Supabase env presence confirmed without printing secrets:
  - `NEXT_PUBLIC_SUPABASE_URL`: present
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: present
  - `SUPABASE_SERVICE_ROLE_KEY`: present
- Dev server ready: yes

| Route | Status | Mode/status | Read-only label | Forms | Buttons | Catalog mutation controls | Secrets/raw env |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/partner/catalog` | 200 | Fallback to mock data | yes | 0 | 6 inherited demo guide buttons | no | no |
| `/partner/catalog/food` | 200 | Fallback to mock data | yes | 0 | 6 inherited demo guide buttons | no | no |
| `/partner/catalog/tours` | 200 | Fallback to mock data | yes | 0 | 6 inherited demo guide buttons | no | no |
| `/partner/catalog/stays` | 200 | Fallback to mock data | yes | 0 | 6 inherited demo guide buttons | no | no |
| `/partner/catalog/products` | 200 | Fallback to mock data | yes | 0 | 6 inherited demo guide buttons | no | no |
| `/admin/catalog` | 200 | Supabase read pilot with safe empty/aggregate state | yes | 0 | 0 | no | no |
| `/admin/catalog/review` | 200 | Supabase read pilot with safe empty/aggregate state | yes | 0 | 0 | no | no |
| `/admin/catalog/food` | 200 | Fallback to mock data | yes | 0 | 0 | no | no |
| `/admin/catalog/tours` | 200 | Fallback to mock data | yes | 0 | 0 | no | no |
| `/admin/catalog/stays` | 200 | Fallback to mock data | yes | 0 | 0 | no | no |
| `/admin/catalog/products` | 200 | Fallback to mock data | yes | 0 | 0 | no | no |
| `/admin/catalog/categories` | 200 | Fallback to mock data | yes | 0 | 0 | no | no |
| `/admin/catalog/safety` | 200 | Supabase read pilot with safe empty safety state | yes | 0 | 0 | no | no |

## Partner Ownership Safe-State Result

Partner Supabase routes rendered safely and fell back to mock data. No unfiltered real partner catalog data was shown. No other business data was intentionally exposed.

## Admin Role Safe-State Result

Admin domain/category routes safely fell back to mock data when real admin role source was unavailable. Admin aggregate routes rendered safe empty/aggregate Supabase states without exposing secrets, forms, or mutation controls.

Note for future hardening: admin aggregate routes should ideally surface `admin_role_source_missing` more explicitly instead of a generic `Supabase read pilot` label when all underlying real reads are blocked.

## No-Write Audit

No write-call matches were found in Stage 33 changed files and Stage 30 catalog UI paths for:

- `.insert(`
- `.update(`
- `.delete(`
- `.upsert(`
- `.rpc(`
- `createOrder`
- `createBooking`
- `createCart`
- `createCheckout`
- `createPayment`
- `updateStock`
- `updateAvailability`
- `audit_logs`

## No-Mutation UI Audit

- No catalog forms found.
- No catalog mutation buttons found.
- Admin catalog routes have zero buttons in the tested HTML.
- Partner catalog routes inherit existing partner layout demo guide buttons, but no catalog create/edit/delete/approve/reject/publish/archive controls were found.

## No-SQL / Schema Audit

- No SQL run.
- No schema files changed.
- No database changes made.
- Stage 21 migration draft remains unapplied.

## Alcohol Safety Audit

- `ALCOHOL_MODULE_ENABLED=false`
- `alcohol_module_settings` untouched.
- No alcohol override.
- No alcohol sales/delivery path.
- Product safety indicators remain read-only.

## Restore Result

- `DATA_SOURCE_MODE=mock`: restored.
- Final build after restore: passed.

## Issues / Notes

- In-app browser automation could not complete the full route sweep, so route rendering was verified through local HTTP route checks.
- Partner pages include inherited demo guide buttons from the existing partner layout.
- Admin aggregate Supabase labels can be clearer in a future refinement.

## Updated Stage 33 Decision

PASS WITH NOTES.
