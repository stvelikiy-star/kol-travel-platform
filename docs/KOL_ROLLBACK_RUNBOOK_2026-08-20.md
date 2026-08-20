# KÖL — Rollback & Recovery Runbook

Prepared: 2026-08-20

## Current release state

Production is not live. This runbook defines the gate before any future staging/production activation; it does not claim that a new backup or deployment has already been created.

## Recovery assets required before first DB apply

1. exact Git commit/PR stack recorded;
2. accepted live-schema fingerprint;
3. fresh logical Postgres backup/export under owner-controlled storage;
4. row-count sanity report for transactional tables;
5. separate Storage object backup once Storage contains files;
6. environment-variable presence report without secret values;
7. tested previous Vercel deployment/preview reference once Vercel exists.

Important: Supabase database backups contain Storage metadata but do not restore the actual Storage objects. Storage files therefore require a separate object backup/export.

## Source / application rollback

Vercel deployments are immutable. After production exists, application rollback should re-point traffic to the last verified deployment rather than rebuilding an old commit during an incident.

Rollback sequence:

1. freeze new deploys;
2. record failing deployment id/commit and request ids;
3. use Vercel Instant Rollback / previous verified deployment;
4. verify `/api/health`, Auth routes and critical read-only flows;
5. keep DB changes in place unless the DB itself is proven to be the fault;
6. fix forward in Git and promote only after preview verification.

## Database rollback principles

### Before payment activation

For staging and pre-payment production, a failed additive migration may be reversed with a reviewed inverse migration or by restoring the staging database. Never improvise destructive SQL during an incident.

### After real payment activation

Never blindly restore the database to an earlier point while an external payment provider has newer settlement truth. A database restore could erase internal records for charges that still exist at the provider.

Required sequence for any financial recovery:

1. disable creation of new payment attempts/webhook application while preserving provider callbacks externally if possible;
2. export provider settlement/event references for the affected window;
3. preserve `payment_provider_events`, `payments` and audit evidence;
4. restore/recover database only with a defined recovery point;
5. replay/reconcile provider events idempotently;
6. verify provider totals against internal payment totals before reopening payments.

No automatic refund is part of recovery.

## Storage rollback

Once `catalog-media` exists and contains files:

- database backup alone is insufficient;
- back up object bytes separately using Supabase Storage tooling or an S3-compatible export;
- preserve bucket/path metadata with the DB backup;
- restore bytes and metadata as one recovery unit;
- never delete old object backup copies during the same release that changes media schema/policies.

## Stop-the-line conditions

Immediately stop the rollout if any of these occur:

- cross-user or cross-partner data access;
- anon access to private/admin/financial data;
- direct browser mutation of bookings/orders/payments/delivery operational truth;
- negative inventory or overbooking under concurrency;
- provider amount mismatch or duplicate settlement without audit evidence;
- delivery transition bypass/ownership failure;
- health endpoint reports blocked in the target environment;
- schema verification differs from the expected post-migration contract.

## Safe degradation

When a subsystem is not proven safe, fail closed by feature:

- bookings: read/search remains available; transactional booking creation disabled;
- food/shop: catalog remains readable; checkout disabled;
- payments: order/booking remains pending; no fabricated success;
- delivery: existing state remains readable; mutation disabled;
- media: catalog may fall back to existing static/reference images; upload disabled;
- AI: may explain or route but cannot invent transactional truth.

## Restore verification

A rollback is not complete until all applicable checks pass:

- source commit/deployment identity confirmed;
- `/api/health` returns expected environment and commit;
- role-by-role Auth/RLS smoke passes;
- booking/order inventory invariants hold;
- payment/provider reconciliation passes if payments were active;
- delivery/order state coherence passes;
- Storage object + metadata sample resolves;
- Security/Performance advisors rerun;
- no unexplained audit gaps in the incident window.

## RPO / RTO

No production RPO or RTO is declared yet. Owner/business must set these before launch based on plan, backup retention, payment criticality and acceptable downtime.
