# Stage 27-3 — Public Catalog Read Pilot Risk and Roadmap Decision

Project: KOL / Issyk-Kul Travel & Delivery Platform.

## Current Milestone

The public catalog read pilot is finalized for:

- `/food`
- `/tours`
- `/stays`
- `/shop`

## What Is Ready

- mock mode works
- controlled Supabase mode works or safely falls back
- labels and fallback states are standardized
- no writes
- no SQL
- no schema changes
- alcohol remains disabled
- shop safety filtering is active

## What Is Not Ready

- production Supabase default
- real partner/admin catalog management
- catalog write permissions
- production RLS policy review
- real image management
- booking/cart/checkout/payment flows
- availability/pricing engine
- alcohol module
- Stage 21 migration apply

## Risk Register

| Risk | Area | Impact | Likelihood | Mitigation | Recommended owner/stage |
| --- | --- | --- | --- | --- | --- |
| Supabase RLS is not production-reviewed | Security | Public/private data exposure risk | Medium | Run a dedicated RLS and public read security review before production | Stage 28/29 security planning |
| Minimal seed data | Data quality | Supabase mode may look sparse | High | Add more safe demo data only after schema/seed plan approval | Catalog data planning |
| Missing `image_url` and SEO fields | UX/SEO | Public pages rely on fallbacks | High | Keep fallback; apply additive migration only after review | Migration apply review |
| No catalog management UI | Operations | Real data cannot be safely managed from app | High | Plan partner/admin management flows before writes | Stage 28 |
| Stage 21 migration not applied | Schema | Some richer fields remain unavailable | Medium | Keep draft unapplied until business requirements are confirmed | Migration review |
| Accidental `DATA_SOURCE_MODE=supabase` default | Operations | Test mode could be treated as default | Low | Keep README/runbook clear; restore mock after tests | Release checklist |
| Shop product safety/alcohol filtering remains pilot-level | Compliance | Unsafe product display risk | Medium | Keep conservative filtering and legal review gate | Compliance planning |
| Service role key should be rotated before production if exposed earlier | Security | Credential risk | Low/Unknown | Rotate before production and use server-only boundaries | Production readiness |
| Public read fallback could mask data issues | QA | Supabase read failures may be missed | Medium | Manual test both labels and logs; document fallback reason | QA/runbook |

## Roadmap Options

### Option A — Stage 28: Partner/Admin Catalog Management Planning

Pros:

- highest product value
- prepares real data operations
- avoids immediate DB migration apply

Cons:

- requires careful write/RLS planning

### Option B — Stage 28: Minimal Additive Migration Apply Review

Pros:

- adds image/SEO/slug fields
- improves data quality

Cons:

- introduces DB change risk
- needs backup and manual approval

### Option C — Stage 28: Production Deployment Readiness Checklist

Pros:

- prepares hosting/release
- checks env/security/RLS

Cons:

- product management flows still absent

### Option D — Stage 28: RLS and Public Read Security Review

Pros:

- improves safety before production

Cons:

- may slow feature progress

## Recommendation

Recommended next stage:

```text
Stage 28 — Partner/Admin Catalog Management Planning
```

Reason:

- public read is stable
- catalog data still needs controlled management workflow
- DB migration should wait until management requirements confirm exact fields
- writes require planning before implementation

## Guardrails For Stage 28

- planning/docs first
- no writes until RLS/write policy plan exists
- no SQL apply
- no payment/cart/booking
- no alcohol
- keep `DATA_SOURCE_MODE=mock` default

