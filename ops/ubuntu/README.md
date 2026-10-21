# KÖL — isolated Ubuntu preview deployment

This is an intentionally **mock-only local preview**. It DOES NOT accept real customer orders, payments or booking changes and does not bypass the application's production fail-closed safeguards.

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
