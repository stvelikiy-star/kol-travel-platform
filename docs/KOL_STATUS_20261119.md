# KÖL — security remediation status — 2026-11-19

**Scope:** audit branch `audit/kol-p0-hardening-20261119`, based on release HEAD
`7b8362f7b7caf460c0c02aa647746784fd2640f0`.
**Release decision:** NO-GO. This document is not authorization to merge or deploy.

## Applied vs not applied

| Workstream | Source branch | Shared/production infrastructure |
| --- | --- | --- |
| Anonymous intake signed timing + honeypot + configured trusted IP hash | Code changed | NOT APPLIED; missing HMAC/ingress configuration fails closed |
| IP and phone rate budget with transaction-scoped PG advisory locks | `027a_*_DRAFT_NOT_APPLIED.sql` and VERIFY prepared | NOT APPLIED to any live/common DB |
| One-step atomically idempotent public intake insert | Server Action now calls service-role-only RPC | NOT RUN against a live/common DB |
| CSP | Report-Only, Supabase/fonts/scene sources declared | NOT ENFORCED; browser compatibility pending |
| HSTS | Only production + request HTTPS | NOT VERIFIED on real HTTPS/domain |
| Auth checks | AST inventory covers recursively all exported actions | CI must validate; public/auth actions are explicit narrow exceptions |
| Mock mode production | Existing 503 safety retained, source and loopback HTTP regression added | Production NOT VERIFIED and NOT ACCESSED |
| Migrations | Existing local-only plan and per-step report, additive 027a only on disposable runner | No managed staging/production migration applied |
| Touch targets | Header/menu/language/footer min 44px, Playwright 320/375/390/430/1440 RU/KG/EN | New browser run pending exact-head CI |

## Important reconciliation

- The actual `supabase/staging/migration-plan.json` on this baseline enumerates **44**, not 42,
  canonical steps. Do not discard or reorder steps to match an older audit.
- `scripts/run-local-supabase-staging-smoke.sh` starts a fresh local disposable
  Supabase, executes every canonical APPLY + associated VERIFY, followed by
  isolated draft 027a, 999 postflight and role-isolation checks.
- The GitHub baseline does **not** contain a distributable verified dump of
  the existing 17 applied managed migration records. A rehearsal specifically
  starting from *that* restored managed baseline is **NOT VERIFIED** here.
- The signed public form proof depends on `KOL_PUBLIC_INTAKE_HMAC_KEY` (32+
  UTF-8 bytes) and `KOL_INTAKE_TRUSTED_IP_HEADER` (one of
  `cf-connecting-ip`, `x-real-ip`, `x-vercel-forwarded-for`).
  **Never trust a client-supplied proxy header**: the trusted ingress must strip
  incoming copies and inject one verified single-IP value. Missing config =>
  safe refusal, no fallback to raw IP or user-provided headers.
- `public_intake_create_atomic` is intentionally absent from the managed
  database until separate migration approval. The new server code will reject
  writes rather than revert to the old non-atomic INSERT.
- New browser HMAC proof is issued at first mount; form must take >=2.5s;
  proof expires after 4 hours. Stable request UUID is retained across network
  retry. No untrusted IP is stored or logged.
- CSP Report-Only permits self-hosted `/kol-stage/scene.html` inline
  scripts/styles to avoid a breaking enforcement rollout; no CSP enforcement
  change was made to other routes. Existing frame-ancestors for scene remains.
- No changes to `DATA_SOURCE_MODE`, `KOL_PRODUCTION_RUNTIME_READY`,
  AI #128, alcohol, payments, refunds, payouts, demo labeling, approved design.
- No changes to live Supabase, shared/real data, Ubuntu, server Docker, Vercel,
  MARINA SMART, AI PROF, n8n or Aska Tash were requested or made.

## Checks — do not conflate evidence

1. **Baseline GitHub CI:** 11/11 workflows SUCCESS on SHA `7b8362f7`.
2. **New branch source checks:** PENDING exact-head `npm run check:release-source`
   (npm audit, lint, tsc, build, existing checks, action auth, intake, CSP,
   migration plan and local mock-production HTTP).
3. **Disposable Supabase:** 10 concurrent intakes, phone variation at same IP,
   retry after lost response, invalid UUID and role ACL — **NOT VERIFIED**
   pending local runner result.
4. **Signed-JWT end-to-end:** client -> request -> operator -> partner ->
   courier as one order, two partners, foreign-row rejection and booking race
   — **NOT VERIFIED** on this source branch. Older PR #166 described a separate
   isolated pass, but its feature/migration branches have NOT been merged here.
5. **Browser:** 320/375/390/430/1440, RU/KG/EN, all targets >=44px
   — **NOT VERIFIED** pending GitHub-hosted Playwright.
6. **Live database, Ubuntu, Vercel, real payments and commercial inventory:**
   **NOT CHECKED**, by explicit constraint.

## Source authorization finding and correction

- The new recursive source gate initially failed on real write action
  `src/app/actions/client/clientBookings.ts::createStayBookingAction`:
  it checked `auth.getUser()` without enforcing an active **client** role.
  **FIXED** with awaited `requireClient()` and deny on `!client.ok`
  before the booking RPC (commit `1e8a7ca`).
- Older `*DemoAction` functions that only return
  `createDemoActionResult`, and the pure demo result factory, are
  intentionally non-writing placeholders, not production Server Actions.
  The scanner only accepts them when their bodies contain no direct
  mutations; a newly added unchecked real write remains a CI failure.
- Anonymous `requestClientAccessAction` intentionally performs
  Supabase Auth OTP onboarding. This **explicit Auth-only exception**
  does not authorize a database RPC or other privileged mutation.
- The first new exact-head security gate **FAILED**, exposing the finding.
  The corrected scan and complete checks are **PENDING** a new run;
  there is no claim of full security PASS until CI proves it.

## Action authorization exception review

The only intentionally unauthenticated actions are:
- `src/app/actions/auth.ts`: known login/logout actions only.
- `src/app/actions/public/intake.ts`: signed proof issuance (read-only)
  and public intake through the reviewed atomic RPC.
No other directory-level exception. Every new export must have an awaited
role guard and a denied-result branch, or a named non-writing demo annotation.
Treat action inspection as a source gate, not proof of SQL/RLS authorization.

## Existing documents kept unchanged

- [Release consolidation/security reconciliation](KOL_CONSOLIDATED_GATE_AUDIT_20261117.md)
- [MVP safe launch](KOL_MVP_SAFE_LAUNCH_2026-09-24.md)
- [Booking concurrency notes](https://github.com/stvelikiy-star/kol-travel-platform/pull/149)
- [Independent local E2E donor candidate](https://github.com/stvelikiy-star/kol-travel-platform/pull/166)

## Remaining before merge / GO

Independent source CI and browser validation; verify real dump of 17 managed
migrations on a disposable clone; inspect SQL/RLS and high-concurrency
behavior with actual local Auth/JWT; reach true one-order two-partner
isolation/booking-race E2E; approve ingress/HMAC configuration, offsite
backup and rollback; owner acceptance. **No auto-merge, no deploy.**
