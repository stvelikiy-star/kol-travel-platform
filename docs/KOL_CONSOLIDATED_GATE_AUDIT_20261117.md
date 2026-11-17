# KÖL unified release integration gate — 2026-11-17

## Verified base

- Pinned source: PR #162, `2ca690dec3e7fdf0958575db70f1d0eb6ced56fd`.
- PR #162 had 11/11 SUCCESS on its pinned SHA (GitHub Actions); this does not establish current branch CI or commercial production readiness.
- Existing approved design / release lineage: PR #143 -> PR #156 -> PR #162.
- Do not merge older PR branches wholesale or apply database migrations to active data.

## PR-specific reconciliation

| PR | Unique changes / result | Decision |
|---|---|---|
| #145 | `src/app/delivery/page.tsx` is the same blob as in PR #162; its two QA scripts differ and need individual baseline compatibility checks. | Do not replace canonical Delivery page; preserve older branch pending QA reconciliation. |
| #144 | `SeasonalShowcase`, `KolConcierge`, `KolIcon`, associated motion and homepage wiring are absent from the integrated base. These may conflict with current `globals.css` and duplicate the newer `KolVisitorAssistant`. | Keep code in the source PR for separate approved-design visual review; no automatic runtime integration. |
| #149 | Includes novel RPC parity/security tests and un-applied SQL proposals for booking idempotency/direct-write boundaries; some parts introduce cross-project MARINA SMART hooks. | Bring over only two non-runtime scripts and a CI safety self-test. Preserve other assets on donor branch pending isolated DB parity and threat-model review. Never apply proposals automatically. |
| #128 | Includes full AI route and widget and expanded EN dictionaries, diverging from current navigation-only visitor assistant. Older dependencies and API interface need independent audit. | Preserve donor branch separately; do not enable AI/API keys or replace visitor assistant in this release. |
| #153 | Git comparison: PR #162 is 346 commits ahead and #153 has no commits ahead of that release ancestry. | Candidate for duplicate PR closure only after release acceptance and dependency audit. |
| #155, #158-#161 | #155 is in integration ancestry. Reviewed selected UUID/a11y/Next.js fixes from #158-#161 are in #162. | Avoid duplicate branch merges; close after acceptance and evidence retention. |

## Isolated safety checks added on this branch

- `scripts/qa-disposable-booking-concurrency.mjs` and `scripts/qa-disposable-booking-safety-selftest.mjs` were copied from PR #149 without changing their business logic.
- CI executes **only** the safety self-test, which must reject unconfigured/known live target endpoints.
- Never run the full concurrency script without explicit disposable database, disposable accounts, and approved seeded fixtures.
- Isolated Ubuntu run of the self-test on 2026-11-17: **PASS**. No database request or service mutation.

## Outstanding acceptance gates

1. GitHub CI for this exact branch SHA, including browser workflows, local disposable Supabase smoke, backup and recovery checks.
2. Read-only parity report for live/staging RPC signatures, Auth/RLS and idempotency. Any new SQL requires separate backup, review and isolated migrations.
3. Confirmed partner prices, dates, inventory and delivery modes; no demo-as-live behavior.
4. E2E: customer -> request/booking -> operator -> partner -> courier with rollback/replay/ownership tests on isolated data. Confirm payment/refund behavior separately.
5. Visual review against approved KÖL master design before selectively integrating #144. Review AI #128 on a separate feature line.
6. Production GO requires owner approval, backup+restore proof, HTTPS and independently validated real data. CI success is necessary, not sufficient.

## No-touch boundaries

No changes to Ubuntu running services, Docker, existing Supabase project, Vercel, MARINA SMART, AI PROF or n8n. Do not delete old branches before all unique code is reconciled.

## Reconciliation evidence addendum — 2026-11-17

- **PR #145:** `src/app/delivery/page.tsx` has identical blob `897d71a52c6843c87ee545cab6c3b2aeb854f62e` in donor and RC. All non-comment lines from old `qa-public-live-read.mjs` exist in newer test; new test adds extra guards. Old client login coverage in `qa-public-flows.mjs` is superseded by stronger `workspaceEntries` loop (admin/partner/courier/client) and scoped passwordless checks.
- **PR #149:** `007a` and `007b` are already part of the staging migration manifest. The `007b` DRAFT adds `pg_advisory_xact_lock` by authenticated user and request key, plus conflicting payload rejection. This is not evidence of application to any live database. Imported #149 concurrency runner requires disposable HTTPS Supabase, JWT, and two seeded rooms. The CI self-test covers only fail-closed target validation. Real parallel HTTP/RPC E2E remains **NOT VERIFIED**.
- **PR #144:** `SeasonalShowcase` references missing `spring-v2-desktop.jpg`, `spring-v2-mobile.jpg`, `summer-v2-desktop.jpg`, `summer-v2-mobile.jpg`. Git tree confirms all four absent in donor head. The old home uses a different presentation from accepted current animated scene, and `KolConcierge` duplicates the current visitor assistant's purpose. No visual browser acceptance; do not cherry-pick.
- **PR #128:** AI route accepts browser-supplied session IDs by prefix without server-side session ownership binding; no route-level authentication/rate limiting or upstream HTTP timeout was found; provider error text may reach server logs, and retry keys are regenerated. Endpoint names are documented but account access/integration is unverified. Exclude until independent abuse, privacy, authentication, quotas, API and RU/KG/EN tests are accepted.
- Release PR #163 was retargeted from #162 head to `integration/kol-unified-20261105` to make the release patch explicit (reviewed #162 fixes + the two isolated security scripts and CI/documentation). This does **not** merge or deploy any branch. Require fresh exact-head GitHub checks after retarget.
