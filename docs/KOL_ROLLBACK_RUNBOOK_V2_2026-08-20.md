# KÖL — Rollback & Recovery Runbook V2

Prepared: 2026-08-20

## Current state

KÖL production is not deployed. This runbook defines prerequisites and incident behavior; it does not claim a backup, staging branch or Vercel deployment already exists.

## Recovery assets required before first staged DB apply

1. exact Git commit recorded
2. accepted live-schema fingerprint and row-count sanity snapshot
3. fresh logical PostgreSQL backup/export under owner-controlled storage
4. migration baseline accepted instead of fabricated history
5. separate Storage-object backup once files exist
6. environment presence/config report without secret values
7. known rollback target for application deployment once Vercel staging/production exists

## Application rollback

Once Vercel exists, treat deployed builds as immutable release artifacts. Prefer switching traffic to the last verified deployment instead of rebuilding an old commit during an incident.

Sequence:
1. freeze new promotions
2. record failing commit/deployment/request ids
3. roll application traffic back to last verified deployment
4. verify `/api/health`, authentication and critical read-only flows
5. keep DB state in place unless DB change is proven to be the fault
6. fix forward in Git and revalidate in staging

## Database rollback before real payments

For staging/pre-payment use a reviewed inverse migration or restore the staging DB from the known recovery point. Do not improvise destructive SQL during an incident.

## Database recovery after real payments

Never blindly restore to an earlier DB point while an external provider can contain newer settlement truth. A restore could erase internal evidence for externally completed charges.

Required financial recovery sequence:
1. stop new payment attempts/event application
2. preserve/export affected provider references and settlement events
3. preserve internal payment/event/audit evidence
4. restore DB only to a defined recovery point
5. replay/reconcile verified provider events idempotently
6. compare provider totals/references to internal totals before reopening

Automatic refund is not a rollback mechanism.

## Storage recovery

Database backups do not substitute for object-byte recovery. Once `catalog-media` contains objects:
- export/backup object bytes separately
- preserve bucket/path metadata with the database recovery set
- restore object bytes and metadata coherently
- do not delete the previous object backup in the same release that changes media schema/policies

## Stop-the-line conditions

Immediately stop rollout on:
- cross-tenant data exposure
- anon/private/admin/financial access violation
- direct browser mutation of protected transactional truth
- negative stock or overbooking
- unexplained payment amount/reference/replay mismatch
- delivery transition/assignment bypass
- Storage ownership/path isolation failure
- blocked/incorrect health state in the target environment
- schema verification mismatch

## Safe degradation

If a subsystem is unproven, fail closed by feature:
- booking/search can remain readable while booking mutation is disabled
- Food/Shop catalog can remain readable while checkout is disabled
- payments remain pending rather than fabricated paid
- delivery remains readable while mutation is disabled
- media may use existing static/reference assets while upload is disabled
- AI may explain/route but cannot invent transactional truth

## RPO / RTO

No production RPO or RTO is declared. Owner/business must set both before production launch based on backup retention, payment criticality and acceptable downtime.
