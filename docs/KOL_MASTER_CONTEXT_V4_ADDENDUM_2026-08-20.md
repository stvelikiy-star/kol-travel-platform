# KÖL — Master Context V4 Addendum

**Date:** 2026-08-20  
**Purpose:** update V4 with technical work prepared after the initial V4 snapshot. This does not replace the full V4 document; it advances its current-state section.

## New draft work after initial V4

- PR #18 — atomic Food/Shop order transaction core, stacked on #15.
  - Food: DB-authoritative menu pricing and minimum order; no invented ingredient stock.
  - Shop: deterministic product locks, non-null stock requirement, atomic decrement.
  - Client cannot submit monetary truth.
  - Idempotent retries.
  - Partner ready-for-pickup becomes one DB transaction with history/audit.
  - Delivery remains pickup-only until a real fee model exists.

- PR #19 — secure private catalog media Storage, stacked on #13.
  - live baseline still has zero buckets/objects/policies.
  - private `catalog-media` design, JPEG/PNG/WebP/AVIF, 8 MiB, no SVG.
  - partner-scoped business/owner path.
  - public active catalog gets short-lived signed URLs, not permanent public objects.
  - server upload uses the user's JWT/RLS; no browser service-role path.

- PR #20 — staging readiness, stacked on #14.
  - real `.env.example` added; broken reference to missing `.env.local.template` repaired.
  - deployment preflight added and actually executed in four safety scenarios.
  - shared deployment safety snapshot + `/api/health`.
  - production mock is blocked; alcohol=true is blocked.

- PR #21 — additive foreign-key index baseline, stacked on #13.
  - live read-only catalog audit found 80 single-column public FKs, 49 without a valid leading index.
  - draft adds those 49 with `CREATE INDEX IF NOT EXISTS` only.
  - no index removal; `unused` notices are not treated as evidence before real traffic.

## Security package strengthened after initial V4

PR #13 now also contains:

- 006a — direct `audit_logs` write lockdown because the recovered live policy allowed authenticated users to fabricate audit content;
- 006b — remaining identity-dependent RLS rewritten to `(select auth.uid())` and explicit authenticated role scope while preserving access logic;
- 006c — fail-closed direct order/booking INSERT lockdown until atomic RPCs are staged.

PR #15 and its #18 stack additionally carry 007a booking direct-INSERT lockdown verification so the transaction flow cannot be bypassed by client-supplied booking totals.

## New verified source/runtime fact

The deployment preflight script was executed in an isolated Node environment:

- development/mock/alcohol-off => PASS
- production/mock => FAIL
- production/Supabase-public-config => PASS
- `NEXT_PUBLIC_SERVICE_ROLE_KEY`-style configuration => FAIL

No fresh full repository lint/TypeScript/Next build is claimed yet. GitHub Actions has still not registered a run for the draft workflow, and the connected GitHub interface does not expose a repository checkout archive for a local full build.

## Updated safe merge/apply concept

Do not apply SQL by PR number order alone. First accept the authoritative live migration baseline, then reconcile the staged drafts into one forward migration sequence.

Logical dependency groups:

1. Security/RLS: #13 (`005`, `006`, security follow-ups)
2. Performance: #21 after security correctness
3. Booking core: #15 (`007` + 007a)
4. Order core: #18 (`008`) after booking stack base
5. Storage/media: #19 (`009`) after security
6. Staging/deploy safety: #14 + #20

Production remains NOT READY and no live DB, Storage, Auth, payment or deployment mutation was performed by these drafts.
