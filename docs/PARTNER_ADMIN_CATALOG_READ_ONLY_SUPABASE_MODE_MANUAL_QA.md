# Stage 31-3 - Partner/Admin Catalog Read-Only Supabase Mode Manual QA

## Setup

- Temporary test mode: `DATA_SOURCE_MODE=supabase`
- Restored safe mode after test: `DATA_SOURCE_MODE=mock`
- Alcohol setting: `ALCOHOL_MODULE_ENABLED=false`
- Supabase env presence confirmed without printing secrets:
  - `NEXT_PUBLIC_SUPABASE_URL`: present
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: present
  - `SUPABASE_SERVICE_ROLE_KEY`: present

## Build Results

- Supabase-mode build: passed.
- Final restored mock-mode build: passed.

## Dev Server Method

Foreground browser QA was not completed in this tool session.

The Stage 31-3 instruction says not to use a silent/background dev server if it is unstable. A prior automated/background dev-server attempt in this session was unstable, so this document does not claim full browser route verification.

Decision is therefore `PASS WITH MANUAL ROUTE RETEST REQUIRED`.

## Partner QA Results

| Route | Opens yes/no | Mode badge/status | Supabase success / fallback / safe auth state | Data/empty state visible | Read-only label | No raw error | No secrets | No forms | No mutation controls | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/partner/catalog` | not checked in browser | build passed | expected Supabase read or fallback | not checked | expected | build only | build only | build only | build only | Manual route retest required. |
| `/partner/catalog/food` | not checked in browser | build passed | expected Supabase read or fallback | not checked | expected | build only | build only | build only | build only | Manual route retest required. |
| `/partner/catalog/tours` | not checked in browser | build passed | expected Supabase read or fallback | not checked | expected | build only | build only | build only | build only | Manual route retest required. |
| `/partner/catalog/stays` | not checked in browser | build passed | expected Supabase read or fallback | not checked | expected | build only | build only | build only | build only | Manual route retest required. |
| `/partner/catalog/products` | not checked in browser | build passed | expected Supabase read or fallback | not checked | expected | build only | build only | build only | build only | Manual route retest required. |

Partner-specific expected retest checks:

- Partner catalog overview opens or safe ownership/auth fallback appears.
- Food/tours/stays/products pages open or safe fallback appears.
- Business context is visible or safely falls back.
- No other business data is intentionally exposed.
- Products page has no alcohol sales/delivery path.

## Admin QA Results

| Route | Opens yes/no | Mode badge/status | Supabase success / fallback / safe auth state | Data/empty state visible | Read-only label | No raw error | No secrets | No forms | No mutation controls | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/admin/catalog` | not checked in browser | build passed | expected Supabase read or fallback | not checked | expected | build only | build only | build only | build only | Manual route retest required. |
| `/admin/catalog/review` | not checked in browser | build passed | expected Supabase read or fallback | not checked | expected | build only | build only | build only | build only | Manual route retest required. |
| `/admin/catalog/food` | not checked in browser | build passed | expected Supabase read or fallback | not checked | expected | build only | build only | build only | build only | Manual route retest required. |
| `/admin/catalog/tours` | not checked in browser | build passed | expected Supabase read or fallback | not checked | expected | build only | build only | build only | build only | Manual route retest required. |
| `/admin/catalog/stays` | not checked in browser | build passed | expected Supabase read or fallback | not checked | expected | build only | build only | build only | build only | Manual route retest required. |
| `/admin/catalog/products` | not checked in browser | build passed | expected Supabase read or fallback | not checked | expected | build only | build only | build only | build only | Manual route retest required. |
| `/admin/catalog/categories` | not checked in browser | build passed | expected Supabase read or fallback | not checked | expected | build only | build only | build only | build only | Manual route retest required. |
| `/admin/catalog/safety` | not checked in browser | build passed | expected Supabase read or fallback | not checked | expected | build only | build only | build only | build only | Manual route retest required. |

Admin-specific expected retest checks:

- Admin catalog overview opens or safe admin auth/role fallback appears.
- Review queue opens safely.
- Food/tours/stays/products pages open or safely fall back.
- Categories page opens read-only or safely falls back.
- Safety page opens read-only or safely falls back.
- No moderation action buttons.
- No category mutation UI.
- No alcohol override controls.

## No-Write Code Search Result

No write calls were found in the Stage 30 read-only files for:

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

Read-only select/order/filter/range behavior remains allowed.

## Alcohol Safety Result

- `ALCOHOL_MODULE_ENABLED=false`
- `alcohol_module_settings` was not touched.
- No alcohol products/categories/items were enabled.
- No alcohol sales/delivery path was added.
- No alcohol override button was added.
- Safety indicators remain read-only and do not enable sale or mutation.

## Restore Result

- `DATA_SOURCE_MODE` restored to `mock`: yes.
- Final restored mock build passed: yes.

## Issues / Blockers

- Browser route checks were not completed because an interactive foreground `npm run dev` browser session cannot be maintained from this tool channel.
- A silent/background dev-server method was not used for the final decision because the instruction explicitly says not to use it if unstable.

## Decision

PASS WITH MANUAL ROUTE RETEST REQUIRED.

## Recommended Next Stage

Stage 31-4 - Partner/Admin Catalog Supabase Mode Browser Retest.
