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
}

requireText(backup, '${KOL_DATABASE_URL:?KOL_DATABASE_URL must be supplied securely outside Git}', "backup script");
requireText(backup, "--format=custom", "backup script");
requireText(backup, "--schema-only", "backup script");
requireText(backup, "pg_restore --list", "backup script");
requireText(backup, "SHA256SUMS", "backup script");
requireText(backup, "public-baseline.tsv", "backup script");

requireText(restore, '${KOL_RESTORE_DATABASE_URL:?KOL_RESTORE_DATABASE_URL must point to an isolated disposable restore target}', "restore script");
requireText(restore, "KOL_RESTORE_CONFIRM", "restore script");
requireText(restore, "RESTORE_TO_DISPOSABLE_TARGET", "restore script");
requireText(restore, "restore target resolves to the same connection string as the source", "restore script");
requireText(restore, "public table count", "restore script");
requireText(restore, "--exit-on-error", "restore script");
requireText(restore, "diff -u", "restore script");
forbid(restore, /\b--clean\b/, "restore script");
forbid(restore, /\bDROP\s+(?:DATABASE|SCHEMA|TABLE)\b/i, "restore script");

console.log("KÖL live backup/restore tooling fail-closed contract: PASS");
console.log("No database connection attempted. No backup or restore executed.");
