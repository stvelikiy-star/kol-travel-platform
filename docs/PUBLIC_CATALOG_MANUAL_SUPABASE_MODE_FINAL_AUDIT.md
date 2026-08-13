# Stage 26-5 Rerun — Public Catalog Manual Supabase Mode Final Audit

Project: KOL / Issyk-Kul Travel & Delivery Platform.

## Summary

Stage 26 validates the public catalog manual test flow for:

- `/food`
- `/tours`
- `/stays`
- `/shop`

Previous decision:

```text
PASS WITH RETEST REQUIRED
```

Rerun note:

The user completed the manual foreground browser retest after the previous audit. The user confirmed that public catalog pages worked in Supabase mode, then restored `DATA_SOURCE_MODE=mock`. The current `.env.local` state confirms `DATA_SOURCE_MODE=mock` and `ALCOHOL_MODULE_ENABLED=false`.

Final decision:

```text
PASS
```

## File Audit

| File | Status |
| --- | --- |
| `docs/PUBLIC_CATALOG_MANUAL_SUPABASE_MODE_TEST_PLAN.md` | Exists |
| `docs/PUBLIC_CATALOG_MOCK_MODE_MANUAL_TEST_RESULTS.md` | Exists |
| `docs/PUBLIC_CATALOG_SUPABASE_MODE_MANUAL_TEST_RESULTS.md` | Exists |
| `docs/PUBLIC_CATALOG_MANUAL_TEST_RESULTS_AND_RETEST_CHECKLIST.md` | Exists |

## Mock Mode Audit

Mock mode results are confirmed from `docs/PUBLIC_CATALOG_MOCK_MODE_MANUAL_TEST_RESULTS.md`.

| Page | Mock status | HTTP | Label | Writes | SQL | Alcohol |
| --- | --- | --- | --- | --- | --- | --- |
| `/food` | PASS | 200 | `Mock data mode` | No | No | Unchanged |
| `/tours` | PASS | 200 | `Mock data mode` | No | No | Unchanged |
| `/stays` | PASS | 200 | `Mock data mode` | No | No | Unchanged |
| `/shop` | PASS | 200 | `Mock data mode` | No | No | Unchanged |

## Supabase Mode Browser Retest Audit

Manual browser retest was completed by the user in a stable foreground dev-server session.

| Page | Supabase retest status | Label expectation | Notes |
| --- | --- | --- | --- |
| `/food` | PASS | `Supabase read pilot` or `Fallback to mock data` | User confirmed page works; no blocking browser issue reported. |
| `/tours` | PASS | `Supabase read pilot` or `Fallback to mock data` | User confirmed page works; no blocking browser issue reported. |
| `/stays` | PASS | `Supabase read pilot` or `Fallback to mock data` | User confirmed page works; no blocking browser issue reported. |
| `/shop` | PASS | `Supabase read pilot` or `Fallback to mock data` | User confirmed page works; shop safety remains active. |

Because exact labels were not separately captured in a machine-readable table, this audit records the user-confirmed browser result:

- pages worked in Supabase mode
- no blocking browser issue reported
- no raw Supabase error reported
- no secret/env values reported in UI
- no page crash reported
- final safe state restored

## Fallback Audit

Fallback behavior is documented and supported by the public catalog read wrappers:

- fallback to mock data
- `Fallback to mock data` label path
- safe no-crash behavior
- no raw Supabase error exposure expected

The Stage 26-3 timeout fallback fix remains in place so unreachable Supabase reads fall back promptly instead of hanging.

## `/shop` Product / Alcohol Safety Audit

Confirmed:

- `ALCOHOL_MODULE_ENABLED=false`
- `alcohol_module_settings` untouched
- no alcohol category tab added
- no alcohol sales/delivery path added
- no cart, checkout, payment, or order path added
- conservative product/alcohol safety filtering remains active in the public shop read adapter
- no alcohol products/categories/items were reported during the successful browser retest

## No-Write Audit

Public catalog read/page files were searched for write indicators:

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

Result: no matches in the audited public catalog read/page files.

This audit confirms no code path was added for writes to:

- products
- shops
- partners
- categories
- orders
- bookings
- availability
- cart
- checkout
- payments
- stock
- audit logs
- alcohol module settings

## Schema / No-SQL Audit

Confirmed:

- no SQL was run by this audit
- Stage 21 SQL draft remains unapplied
- no schema files were changed
- no database changes were made

## DATA_SOURCE_MODE Rollback Audit

Final `.env.local` state confirmed:

```text
DATA_SOURCE_MODE=mock
ALCOHOL_MODULE_ENABLED=false
```

## Build Result

`npm run build` result for this rerun:

```text
Passed
```

The known non-blocking webpack cache warning may appear after a successful build:

```text
Caching failed for pack: Error: Unable to snapshot resolve dependencies
```

## Final Decision

Decision:

```text
PASS
```

Reason:

- Mock mode passed for all four public catalog pages.
- Manual Supabase browser retest was completed by the user for all four public catalog pages.
- Pages worked or safely fell back in Supabase mode.
- No blocking browser issue, raw Supabase error, secret exposure, or page crash was reported.
- `DATA_SOURCE_MODE` is restored to `mock`.
- `ALCOHOL_MODULE_ENABLED=false`.
- Final build passed.
- No writes, SQL, schema, database, payment, booking, cart, checkout, order, availability, stock, audit, or alcohol changes were added.

## Recommended Next Stage

Recommended next stage:

```text
Stage 27 — Public Catalog Supabase Read Pilot Finalization
```

Purpose:

- lock the current successful public catalog read pilot state
- keep `DATA_SOURCE_MODE=mock` by default
- document that `/food`, `/tours`, `/stays`, and `/shop` are ready as controlled read pilots
- decide the next roadmap branch:
  - partner/admin catalog management planning
  - minimal additive migration apply review
  - production deployment readiness checklist

