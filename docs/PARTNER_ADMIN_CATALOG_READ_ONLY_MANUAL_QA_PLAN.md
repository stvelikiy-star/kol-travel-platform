# Stage 31-1 - Partner/Admin Catalog Read-Only Manual QA Plan

## Purpose

This plan prepares safe manual browser checks for the Stage 30 partner/admin catalog read-only routes.

The QA goal is to verify:

- Stage 30 read-only partner/admin routes render.
- Mock mode works.
- Supabase mode works or safely falls back.
- No writes or mutations are available from the UI.
- No raw errors, secrets, or private env values are shown.
- Alcohol remains disabled.

## Routes To Test

Partner:

- `/partner/catalog`
- `/partner/catalog/food`
- `/partner/catalog/tours`
- `/partner/catalog/stays`
- `/partner/catalog/products`

Admin:

- `/admin/catalog`
- `/admin/catalog/review`
- `/admin/catalog/food`
- `/admin/catalog/tours`
- `/admin/catalog/stays`
- `/admin/catalog/products`
- `/admin/catalog/categories`
- `/admin/catalog/safety`

## Mock Mode Procedure

Set:

```env
DATA_SOURCE_MODE=mock
```

PowerShell:

```powershell
(Get-Content .env.local | Where-Object { $_ -notmatch '^DATA_SOURCE_MODE' }) + 'DATA_SOURCE_MODE=mock' | Set-Content .env.local
```

Run:

```powershell
npm run build
npm run dev
```

Open all partner/admin routes manually.

Expected:

- Each page loads.
- Mode badge shows `Mock data mode` or another safe mock label.
- No page crash.
- No raw error is shown.
- No secret or env value is shown.
- No mutation buttons are present.
- No forms are present.
- No write actions are triggered.
- Alcohol remains disabled.

## Supabase Mode Procedure

Temporarily set:

```env
DATA_SOURCE_MODE=supabase
```

PowerShell:

```powershell
(Get-Content .env.local | Where-Object { $_ -notmatch '^DATA_SOURCE_MODE' }) + 'DATA_SOURCE_MODE=supabase' | Set-Content .env.local
```

Run:

```powershell
npm run build
npm run dev
```

Open all partner/admin routes manually.

Expected:

- Each page loads or safely falls back.
- Mode badge shows `Supabase read pilot` or `Fallback to mock data`.
- No raw Supabase error is shown.
- No secret or env value is shown.
- No crash or hang.
- No mutation buttons are present.
- No forms are present.
- No writes are triggered.
- Product/alcohol safety remains active.

## Restore Procedure

After Supabase testing, restore:

```env
DATA_SOURCE_MODE=mock
```

PowerShell:

```powershell
(Get-Content .env.local | Where-Object { $_ -notmatch '^DATA_SOURCE_MODE' }) + 'DATA_SOURCE_MODE=mock' | Set-Content .env.local
```

Run:

```powershell
npm run build
```

## Mock Mode QA Table

| Route | Mode | HTTP/page opens | Mode badge | Data visible or empty state | No raw error | No secrets | No forms | No mutation buttons | Alcohol safe | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/partner/catalog` | mock |  |  |  |  |  |  |  |  |  |
| `/partner/catalog/food` | mock |  |  |  |  |  |  |  |  |  |
| `/partner/catalog/tours` | mock |  |  |  |  |  |  |  |  |  |
| `/partner/catalog/stays` | mock |  |  |  |  |  |  |  |  |  |
| `/partner/catalog/products` | mock |  |  |  |  |  |  |  |  |  |
| `/admin/catalog` | mock |  |  |  |  |  |  |  |  |  |
| `/admin/catalog/review` | mock |  |  |  |  |  |  |  |  |  |
| `/admin/catalog/food` | mock |  |  |  |  |  |  |  |  |  |
| `/admin/catalog/tours` | mock |  |  |  |  |  |  |  |  |  |
| `/admin/catalog/stays` | mock |  |  |  |  |  |  |  |  |  |
| `/admin/catalog/products` | mock |  |  |  |  |  |  |  |  |  |
| `/admin/catalog/categories` | mock |  |  |  |  |  |  |  |  |  |
| `/admin/catalog/safety` | mock |  |  |  |  |  |  |  |  |  |

## Supabase Mode QA Table

| Route | Mode | HTTP/page opens | Mode badge | Data visible or empty state | No raw error | No secrets | No forms | No mutation buttons | Alcohol safe | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/partner/catalog` | supabase |  |  |  |  |  |  |  |  |  |
| `/partner/catalog/food` | supabase |  |  |  |  |  |  |  |  |  |
| `/partner/catalog/tours` | supabase |  |  |  |  |  |  |  |  |  |
| `/partner/catalog/stays` | supabase |  |  |  |  |  |  |  |  |  |
| `/partner/catalog/products` | supabase |  |  |  |  |  |  |  |  |  |
| `/admin/catalog` | supabase |  |  |  |  |  |  |  |  |  |
| `/admin/catalog/review` | supabase |  |  |  |  |  |  |  |  |  |
| `/admin/catalog/food` | supabase |  |  |  |  |  |  |  |  |  |
| `/admin/catalog/tours` | supabase |  |  |  |  |  |  |  |  |  |
| `/admin/catalog/stays` | supabase |  |  |  |  |  |  |  |  |  |
| `/admin/catalog/products` | supabase |  |  |  |  |  |  |  |  |  |
| `/admin/catalog/categories` | supabase |  |  |  |  |  |  |  |  |  |
| `/admin/catalog/safety` | supabase |  |  |  |  |  |  |  |  |  |

## Partner-Specific Checks

For partner routes, verify:

- Read-only label is visible.
- Business context is visible or safely falls back.
- Counts are visible.
- Status badges are visible.
- Product safety badge appears if relevant.
- No create, edit, delete, submit, archive, approve, reject, or publish buttons.
- No forms.

## Admin-Specific Checks

For admin routes, verify:

- Read-only admin label is visible.
- Overview counts are visible.
- Review queue renders safely.
- Categories page is read-only.
- Safety panel is read-only.
- No approve, reject, publish, archive, create, edit, or delete buttons.
- No forms.

## No-Write QA

During browser QA, confirm no UI path triggers:

- `insert`
- `update`
- `delete`
- `upsert`
- write `rpc`
- create order
- create booking
- create cart
- create checkout
- create payment
- update stock
- update availability
- insert `audit_logs`

## Alcohol QA

Confirm:

- `ALCOHOL_MODULE_ENABLED=false`
- No alcohol enablement UI.
- No alcohol product/category/item sales path.
- No override controls in admin safety page.
- Product safety flags do not enable sales.

## Known Limitation

If local foreground `npm run dev` cannot be maintained, document:

- Build passed.
- Browser route check incomplete.
- Decision should be `PASS WITH MANUAL ROUTE RETEST REQUIRED`.

## Safety Notes

- Do not apply SQL.
- Do not run Supabase SQL.
- Do not modify schema files.
- Do not modify the database.
- Do not touch `alcohol_module_settings`.
- After any Supabase-mode test, restore `DATA_SOURCE_MODE=mock`.

## Recommended Next Stage

Stage 31-2 - Execute Partner/Admin Catalog Mock Mode Manual QA.
