import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const backupPath = path.join(root, "scripts/backup-live-supabase.sh");
const restorePath = path.join(root, "scripts/rehearse-live-backup-restore.sh");
const ubuntuPath = path.join(root, "scripts/ubuntu-kol-backup-restore.sh");

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function read(file) {
  if (!fs.existsSync(file)) fail(`missing required file: ${path.relative(root, file)}`);
  return fs.readFileSync(file, "utf8");
}

function requireText(source, value, label) {
  if (!source.includes(value)) fail(`${label} is missing required guard: ${value}`);
}

function forbid(source, pattern, label) {
  if (pattern.test(source)) fail(`${label} contains forbidden unsafe pattern: ${pattern}`);
}

const backup = read(backupPath);
const restore = read(restorePath);
const ubuntu = read(ubuntuPath);
const rehearsalCI = read(path.join(root, "scripts/run-live-backup-restore-rehearsal-ci.sh"));
const startupHelper = read(path.join(root, "scripts/start-local-supabase-with-retry.sh"));
const recoveryWorkflow = read(path.join(root, ".github/workflows/live-backup-restore-rehearsal.yml"));

// PRs only validate tooling. Real source reads require manual dispatch or an
// explicitly marked push to the existing trusted release branch.
for (const guard of [
  "github.repository == 'stvelikiy-star/kol-travel-platform'",
  "github.event_name == 'workflow_dispatch'",
  "github.event_name == 'push'",
  "github.ref == 'refs/heads/release/kol-approved-ui-rc1-20261022'",
  "contains(github.event.head_commit.message, '[kol-source-recovery]')"
]) {
  requireText(recoveryWorkflow, guard, "real-source workflow trigger");
}

for (const [source, label] of [[backup, "backup script"], [restore, "restore script"], [ubuntu, "Ubuntu wrapper"]]) {
  requireText(source, "set -Eeuo pipefail", label);
  requireText(source, "umask 077", label);
  forbid(source, /https:\/\/[^\s"']+:[^\s"']+@/i, label);
  forbid(source, /(?:^|\s)--clean(?:\s|$)/m, label);
  forbid(source, /\bDROP\s+(?:DATABASE|SCHEMA|TABLE)\b/i, label);
}

// Backup/restore scripts must never print connection secrets. The interactive
// Ubuntu wrapper is allowed to write KOL_DATABASE_URL into its chmod-600 local
// env file, so the broad printf/echo guard is intentionally scoped away from it.
for (const [source, label] of [[backup, "backup script"], [restore, "restore script"]]) {
  forbid(source, /echo\s+.*KOL_(?:DATABASE|RESTORE_DATABASE)_URL/i, label);
  forbid(source, /printf\s+.*KOL_(?:DATABASE|RESTORE_DATABASE)_URL/i, label);
}
forbid(ubuntu, /(?:echo|printf)[^\n]*\$KOL_DATABASE_URL/i, "Ubuntu wrapper");

requireText(backup, '${KOL_DATABASE_URL:?KOL_DATABASE_URL must be supplied securely outside Git}', "backup script");
requireText(backup, "supabase db dump", "backup script");
requireText(backup, "roles.sql", "backup script");
requireText(backup, "--role-only", "backup script");
requireText(backup, "schema.sql", "backup script");
requireText(backup, "--schema supabase_migrations", "backup migration ledger");
requireText(backup, "migration-schema.sql", "backup migration ledger");
requireText(backup, "migration-data.sql", "backup migration ledger");
requireText(backup, "migration_ledger_fingerprint_v1", "backup migration ledger");
requireText(backup, "data.sql", "backup script");
requireText(backup, "--use-copy", "backup script");
requireText(backup, "--data-only", "backup script");
requireText(backup, "source-baseline.tsv", "backup script");
requireText(backup, "source-extensions.tsv", "backup script");
requireText(backup, "source-custom-roles.tsv", "backup script");
requireText(backup, "role_restore_mode=preprovisioned-supabase-managed-roles-with-custom-role-gate", "backup script");
requireText(backup, "public_columns_fingerprint_v1", "backup script");
requireText(backup, "auth.users", "backup script");
requireText(backup, "storage.objects", "backup script");
requireText(backup, "SHA256SUMS", "backup script");
forbid(backup, /\bpg_dump\b/, "backup script");
forbid(backup, /\bpg_restore\b/, "backup script");

requireText(restore, '${KOL_RESTORE_DATABASE_URL:?KOL_RESTORE_DATABASE_URL must point to an isolated disposable Supabase-compatible restore target}', "restore script");
requireText(restore, "KOL_RESTORE_CONFIRM", "restore script");
requireText(restore, "RESTORE_TO_DISPOSABLE_TARGET", "restore script");
requireText(restore, "public table count", "restore script");
requireText(restore, "--single-transaction", "restore script");
requireText(restore, "--variable ON_ERROR_STOP=1", "restore script");
requireText(restore, "SET session_replication_role = replica", "restore script");
requireText(restore, "source-extensions.tsv", "restore script");
requireText(restore, "missing-extensions.txt", "restore script");
requireText(restore, "source-custom-roles.tsv", "restore script");
requireText(restore, "custom PostgreSQL roles require an explicit restore plan", "restore script");
requireText(restore, "required-managed-role-names.txt", "restore script");
requireText(restore, "managed_roles_replayed=false", "restore script");
requireText(restore, "filtered-supabase-admin-owner-lines.txt", "restore script");
requireText(restore, "schema-local-restore.sql", "restore script");
requireText(restore, "OWNER TO \"?supabase_admin\"?", "restore script");
requireText(restore, '--file "$EVIDENCE_DIR/schema-local-restore.sql"', "restore script");
requireText(restore, '"$BACKUP_DIR/migration-schema.sql"', "restore migration ledger");
requireText(restore, '--file "$BACKUP_DIR/migration-data.sql"', "restore migration ledger");
requireText(restore, "supabase_admin_owner_statements_filtered", "restore script");
requireText(restore, "diff -u", "restore script");
requireText(restore, "RESTORE_REHEARSAL_PASS", "restore script");
forbid(restore, /--file\s+"\$BACKUP_DIR\/roles\.sql"/, "restore script");
forbid(restore, /--file\s+"\$BACKUP_DIR\/schema\.sql"/, "restore script");
forbid(restore, /\bpg_restore\b/, "restore script");

const pinnedVersion = /SUPABASE_CLI_VERSION="([0-9]+\.[0-9]+\.[0-9]+)"/;
const ubuntuCliVersion = ubuntu.match(pinnedVersion)?.[1];
const ciCliVersion = recoveryWorkflow.match(pinnedVersion)?.[1];
if (!ubuntuCliVersion || !ciCliVersion || ubuntuCliVersion !== ciCliVersion) {
  fail("Ubuntu and live recovery CI must pin the same Supabase CLI version");
}
requireText(ubuntu, "Replacing Supabase CLI", "Ubuntu wrapper");
requireText(ubuntu, "verify_storage_schema_compatibility", "Ubuntu wrapper");
requireText(ubuntu, "select id, name, hash from storage.migrations order by id", "Ubuntu wrapper");
requireText(ubuntu, "Unreviewed Storage ledger difference", "Ubuntu Storage rejection guard");
requireText(ubuntu, "storage_ledgers_compatible", "Ubuntu reviewed Storage ledger check");
requireText(ubuntu, 'source == target', "Ubuntu Storage hash comparison");
requireText(ubuntu, 'public.ecr.aws/supabase/storage-api:v1.84.19', "Ubuntu reviewed Storage image");
requireText(ubuntu, '"$source_objects" == "0,0" && "$target_objects" == "0,0"', "Ubuntu empty Storage exception guard");
requireText(ubuntu, "versioning_status", "Ubuntu wrapper");
requireText(ubuntu, "is_delete_marker", "Ubuntu wrapper");
requireText(ubuntu, "is_versioned", "Ubuntu wrapper");
requireText(ubuntu, "chmod 600", "Ubuntu wrapper");
requireText(ubuntu, "ensure_disposable_target_available", "Ubuntu isolation guard");
requireText(ubuntu, "docker volume ls", "Ubuntu isolation guard");
requireText(ubuntu, "RELEASE_COMMIT", "Ubuntu verified release selection");
requireText(ubuntu, "bash scripts/run-live-backup-restore-rehearsal-ci.sh", "Ubuntu canonical recovery");
forbid(ubuntu, /git[^\n]*reset\s+--hard/, "Ubuntu checkout preservation");

// The real-source CI rehearsal must use the SAME proven fallback as DB-runtime
// smoke tests; an unverified backup must never be reported as successful.
requireText(rehearsalCI, "bash scripts/start-local-supabase-with-retry.sh", "CI restore rehearsal");
requireText(rehearsalCI, "storage_snapshot", "CI source Storage bytes gate");
requireText(rehearsalCI, '[[ "$storage_snapshot" != "0,0" ]]', "CI source Storage bytes gate");
requireText(rehearsalCI, "object-byte recovery must be implemented and rehearsed", "CI source Storage bytes gate");
requireText(rehearsalCI, "sha256sum -c ./evidence/SHA256SUMS", "CI restore rehearsal");
// The restored managed-staging baseline must be enforced by an executable
// stop-on-error SQL gate, not merely printed by the preflight SELECT.
// Otherwise a PR check could appear green even when the migration rehearsal
// has run against the wrong or drifted source shape.
for (const guard of [
  "Managed restored-baseline safety gate",
  "managed_restored_baseline_gate_failed",
  "v_tables<>54",
  "v_rls<>54",
  "v_functions<>10",
  "v_known<>10",
  "v_bad_paths<>0",
  "v_definers<>0",
  "v_indexes<>151",
  "v_invalid<>0",
  "v_stage21<>0",
  "PRESERVE_SQL",
  "from public.stays",
  "from public.rooms",
  "from public.tours",
  "from public.products",
  "before-operational-ids.csv",
  "bookings_values",
  "orders_values",
  "deliveries_values",
  "payments_values",
  "after-operational-ids.csv",
  "restored-live migrations changed existing user or operational record identifiers",
  "ON_ERROR_STOP=1"
]) {
  requireText(rehearsalCI, guard, "CI restored-baseline fail-closed gate");
}
requireText(rehearsalCI, 'psql_file "Restored-live preflight"', "CI restored-baseline preflight");
requireText(rehearsalCI, 'psql_file "Restored-live postflight"', "CI restored-baseline postflight");
requireText(rehearsalCI, 'psql_file "Restored-copy role isolation"', "CI restored-baseline role isolation");

forbid(rehearsalCI, /sha256sum[^\n]*\|\|\s*true/, "CI restore rehearsal");
requireText(startupHelper, "SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io", "local Supabase startup fallback");
requireText(startupHelper, "Local Supabase start failed after four attempts", "local Supabase startup fallback");

console.log("KÖL live backup/restore tooling fail-closed contract: PASS");
console.log("Supabase-aware portable backup is retained; managed roles and reserved supabase_admin ownership are validated/filtered only for disposable local restore.");
console.log("Ubuntu and CI pin the same Supabase CLI; unreviewed Storage differences are rejected and the reviewed 73-to-74 exception requires empty Storage and the verified image.");
console.log("No database connection attempted. No backup or restore executed.");
