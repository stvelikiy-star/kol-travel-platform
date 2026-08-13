# Read Adapter Rollback Plan

Stage: 12K-4 - Read Adapter Rollback Plan.

This plan defines how to roll back future Supabase read adapter validation if reads fail or expose risk. Do not connect Supabase yet, do not switch `DATA_SOURCE_MODE` to `supabase`, and do not add real writes.

`ALCOHOL_MODULE_ENABLED=false` by default. Alcohol sales and delivery are disabled.

## 1. Goal

- Define rollback process if Supabase read adapters fail later.
- Keep mock mode as safe fallback.
- Prevent broken public/internal pages.
- Avoid production downtime.
- Make rollback possible through one environment-mode change.

## 2. Current Safe State

- App works in `DATA_SOURCE_MODE=mock`.
- Mock data must not be deleted.
- Demo actions must not be removed.
- Supabase reads are not active yet.
- Real writes are not connected yet.
- App builds without real Supabase env values.

## 3. Future Rollback Trigger Cases

Rollback to mock mode if any of these happen:

- Supabase env missing.
- Supabase connection error.
- Table name mismatch.
- RLS blocks expected read.
- Adapter mapping error.
- Empty data breaks UI.
- Slug lookup fails.
- Internal page exposes wrong data.
- Build fails after read adapter changes.
- Hydration/runtime error appears.
- Private env accidentally imported into client component.

## 4. Immediate Rollback Steps

1. Set `DATA_SOURCE_MODE=mock`.
2. Restart dev server.
3. Clear `.next` if needed.
4. Run `npm run build`.
5. Verify public pages.
6. Verify partner/courier/admin pages.
7. Do not delete Supabase test project.
8. Do not delete mock data.

Rollback should restore the last known safe mock-powered app without touching Supabase test data.

## 5. Local Recovery Commands

Documented local recovery flow:

```powershell
Ctrl + C
```

If raw HTML, stale static chunks or cache-related issues appear, delete `.next` manually in the project folder.

Then run:

```powershell
npm run dev
```

Refresh the browser with:

```text
Ctrl + F5
```

Final check:

```powershell
npm run build
```

## 6. Pages To Verify After Rollback

### Public

- `/`
- `/tours`
- `/stays`
- `/food`
- `/shop`
- `/partners`

### Partner

- `/partner`
- `/partner/orders`
- `/partner/stop`
- `/partner/catalog`
- `/partner/availability`

### Courier

- `/courier`
- `/courier/active`
- `/courier/issues`

### Admin

- `/admin/delivery`
- `/admin/ai-dispatcher`

## 7. Adapter Safety Rules

- Pages must read through `src/lib/data` functions.
- Pages must not import Supabase directly.
- Service role key must never be imported in client components.
- Adapters must handle empty data.
- Adapters must return safe fallback or safe error.
- Raw Supabase errors must not leak to UI.
- Adapter failures must not remove mock fallback.

## 8. Future Feature Flag Rules

- `DATA_SOURCE_MODE=mock` is default.
- `DATA_SOURCE_MODE=supabase` only after test validation.
- Rollback must be one env change.
- Public read pilot before internal read pilot.
- Reads before writes.
- No payment/refund writes during read validation.
- No Telegram/n8n notifications during read validation.

## 9. Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`.
- Alcohol sales and delivery are disabled.
- Rollback must not enable alcohol module.
- Public catalog must not show alcohol products.
- AI cannot enable alcohol module.
- Partner, courier and admin cannot enable alcohol.
- Future activation requires legal review, licensing, partner verification and `super_admin` approval.
- Alcohol-related request is critical risk.

## 10. Next Stages

Recommended next stages:

1. `12L-1 First Real Write Pilot Plan`
2. `12M Auth + Role Implementation Plan`
3. `12N Audit Log Implementation Plan`
4. `12O Notification Integration Plan`
