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
requireText(restore, "supabase_admin_owner_statements_filtered", "restore script");
requireText(restore, "diff -u", "restore script");
requireText(restore, "RESTORE_REHEARSAL_PASS", "restore script");
forbid(restore, /--file\s+"\$BACKUP_DIR\/roles\.sql"/, "restore script");
forbid(restore, /--file\s+"\$BACKUP_DIR\/schema\.sql"/, "restore script");
forbid(restore, /\bpg_restore\b/, "restore script");

requireText(ubuntu, 'SUPABASE_CLI_VERSION="2.117.0"', "Ubuntu wrapper");
requireText(ubuntu, "Replacing Supabase CLI", "Ubuntu wrapper");
requireText(ubuntu, "verify_storage_schema_compatibility", "Ubuntu wrapper");
requireText(ubuntu, "select id, name, hash from storage.migrations order by id", "Ubuntu wrapper");
requireText(ubuntu, "Local Supabase Storage schema does not match live KÖL", "Ubuntu wrapper");
requireText(ubuntu, "versioning_status", "Ubuntu wrapper");
requireText(ubuntu, "is_delete_marker", "Ubuntu wrapper");
requireText(ubuntu, "is_versioned", "Ubuntu wrapper");
requireText(ubuntu, "chmod 600", "Ubuntu wrapper");

console.log("KÖL live backup/restore tooling fail-closed contract: PASS");
console.log("Supabase-aware portable backup is retained; managed roles and reserved supabase_admin ownership are validated/filtered only for disposable local restore.");
console.log("Ubuntu rehearsal pins a hosted-compatible Supabase CLI and refuses to run when local Storage migrations differ from live KÖL.");
console.log("No database connection attempted. No backup or restore executed.");
