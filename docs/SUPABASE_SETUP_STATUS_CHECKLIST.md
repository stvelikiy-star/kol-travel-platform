# Supabase Setup Status Checklist

Use this checklist for manual Supabase TEST project setup.

| Item | Status | Notes |
| --- | --- | --- |
| Supabase project created | Not Ready | Use `kol-travel-platform-test`. |
| `.env.local` created | Not Ready | Copy from `.env.local.template`; do not commit. |
| `DATA_SOURCE_MODE=mock` | Ready | Must remain default. |
| `ALCOHOL_MODULE_ENABLED=false` | Ready | Must remain default. |
| `npm run build` passed | Unknown | Run locally after setup. |
| SQL 001 passed | Not Ready | Run manually in test project. |
| SQL 002 passed | Not Ready | Run only after SQL 001 passes. |
| SQL 003 passed | Not Ready | Run only after SQL 002 passes. |
| Tables visible | Not Ready | Verify in Supabase table editor. |
| Auth users created | Not Ready | Use fake test users only. |
| Profiles mapped | Not Ready | Map roles and ids manually. |
| `partner@test.kol` has `partner_id` | Not Ready | Required for first real write. |
| Order exists with same `partner_id` | Not Ready | Required for first real write. |
| Order status `accepted_by_partner` or `preparing` | Not Ready | Required source status. |
| `audit_logs` table exists | Not Ready | Must be protected by RLS. |
| RLS checked | Not Ready | Include deny tests. |
| Final build passed | Unknown | Run after manual setup. |

Keep `.env.local` private. Do not switch to real writes until every required item is verified.
