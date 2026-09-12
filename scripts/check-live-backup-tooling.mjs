import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const backupPath = path.join(root, "scripts/backup-live-supabase.sh");
const restorePath = path.join(root, "scripts/rehearse-live-backup-restore.sh");

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

for (const [source, label] of [[backup, "backup script"], [restore, "restore script"]]) {
  requireText(source, "set -Eeuo pipefail", label);
  requireText(source, "umask 077", label);
  forbid(source, /https:\/\/[^\s"']+:[^\s"']+@/i, label);
  forbid(source, /echo\s+.*KOL_(?:DATABASE|RESTORE_DATABASE)_URL/i, label);
  forbid(source, /printf\s+.*KOL_(?:DATABASE|RESTORE_DATABASE)_URL/i, label);
  forbid(source, /(?:^|\s)--clean(?:\s|$)/m, label);
  forbid(source, /\bDROP\s+(?:DATABASE|SCHEMA|TABLE)\b/i, label);
}

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
requireText(restore, "diff -u", "restore script");
requireText(restore, "RESTORE_REHEARSAL_PASS", "restore script");
forbid(restore, /\bpg_restore\b/, "restore script");

console.log("KÖL live backup/restore tooling fail-closed contract: PASS");
console.log("Supabase-aware portable roles/schema/data workflow is enforced.");
console.log("No database connection attempted. No backup or restore executed.");
