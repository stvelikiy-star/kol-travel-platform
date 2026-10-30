# KÖL — isolated Ubuntu preview deployment

> **Approved production target:** the owner's Ubuntu server will host KÖL's authoritative dedicated database. The implementation and mandatory migration/backup/restore gates are documented in [DATABASE_CUTOVER_PLAN.md](./DATABASE_CUTOVER_PLAN.md). This preview compose file is deliberately mock-only; it is not the authoritative PostgreSQL/Auth deployment.


This is an intentionally **mock-only local preview**. It DOES NOT accept real customer orders, payments or booking changes and does not bypass the application's production fail-closed safeguards.

## Recovery preparation after verified source rehearsal (2026-10-29)

The real-source backup, restored-copy 43-step migration plan, role checks and rollback
passed in [run 40901414979](https://github.com/stvelikiy-star/kol-travel-platform/actions/runs/40901414979)
at `884bcf98fc5cf06f4c4eb765fe2f8d042ccfea92`. This is recovery evidence, not Ubuntu runtime acceptance.

`scripts/ubuntu-kol-backup-restore.sh` selects that verified commit from the existing
release branch, refuses a dirty or wrong-origin ops checkout, and never resets local
changes. Its CLI stays inside the KÖL toolchain. Existing KÖL Supabase containers,
volumes or occupied disposable ports block startup instead of being stopped/reused.
After its additional Storage compatibility gate, it invokes the same recovery,
migration, role-isolation and rollback procedure as CI and retains encrypted evidence.
It does not deploy a production database or enable real customer operations.

Run the read-only `ops/ubuntu/preflight-readonly.sh` on the actual host before any
recovery/deployment operation. Actual host resources, SSH reachability and a compatible
Auth/API runtime still need verification. No live-host results are claimed here.

Run from repository root after reviewing resource availability:

```bash
docker compose -f ops/ubuntu/compose.yaml config
docker compose -f ops/ubuntu/compose.yaml build kol-web
docker compose -f ops/ubuntu/compose.yaml up -d kol-web
docker compose -f ops/ubuntu/compose.yaml ps
curl -fsS http://127.0.0.1:3100/api/health
```

The host listens only on 127.0.0.1:3100 (no public exposure); does not create Postgres containers, change any existing Marina Smart/n8n compose project or touch existing volumes. Avoid overlapping ports and verify available disk/memory before building. The .dockerignore excludes secrets and database dumps. A dedicated KÖL Postgres instance and production API will be introduced in a separate reviewed change **only** after existing Supabase recovery, schema inventory, off-machine backup and independent restore validation; silently spinning up an empty database would lose existing business data. Never switch `DATA_SOURCE_MODE` to `supabase` without a proven data migration.

Rollback: `docker compose -f ops/ubuntu/compose.yaml down` (does not remove persistent volumes or touch other projects).

Public `kol.go.kg` DNS/tunnel configuration is separate and must never route actual users to this mock preview as though it were live production.

Resource note: Ubuntu laptop has ~7.1GiB RAM, ~35GiB available disk at audit, and MARINA/n8n already running; this preview limits KÖL to 896MiB RAM and 1.5 CPU cores. Docker build may require additional temporary disk. No destructive cache cleanup is included.

Source UI baseline: user-approved 2026-10-07 preview of `launch/production-gate-2026-09-25`. Do not substitute `main` or onboarding branch for approved design.
