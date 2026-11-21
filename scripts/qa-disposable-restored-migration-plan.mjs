// Migration gate against an explicitly restored, disposable *local* Supabase DB.
// NEVER reads a remote server or creates/updates a production database.
// Requires operator-supplied restored baseline with 17 migration records.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const manifest = JSON.parse(fs.readFileSync("supabase/staging/migration-plan.json", "utf8"));
const reportFile = process.env.KOL_DISPOSABLE_REPORT ?? "kol-disposable-migration-report.json";
const report = {
  status: "NOT VERIFIED",
  source: "restored disposable local baseline only",
  baselineMigrationRecordsRequired: 17,
  requestedHistoricalPlanSteps: 42,
  manifestStepsFound: manifest.migrations.length,
  planCountMismatch: manifest.migrations.length !== 42,
  checks: []
};
const writeReport = () => fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + "\n");

function abort(reason, exitCode = 2) {
  report.reason = reason;
  writeReport();
  console.error("KÖL migration gate: NOT VERIFIED: " + reason);
  process.exit(exitCode);
}

const databaseUrl = process.env.KOL_DISPOSABLE_RESTORED_DB_URL;
if (!databaseUrl || process.env.KOL_CONFIRMED_EPHEMERAL_RESTORED_DB !== "true") {
  abort("No explicitly confirmed disposable restored database; no SQL executed");
}
let parsed;
try { parsed = new URL(databaseUrl); } catch { abort("Invalid local DB URL"); }
if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(parsed.hostname) ||
    !["postgresql:", "postgres:"].includes(parsed.protocol) || parsed.port !== "54322") {
  abort("Refusing any non-local or non-Supabase-CLI database endpoint");
}
if (!["postgres", "kol_disposable"].includes(parsed.pathname.slice(1))) {
  abort("Unexpected database name for disposable local Supabase");
}
if (process.env.KOL_ALLOW_LOCAL_DDL !== "true") abort("Explicit local-only DDL approval absent");
if (!Array.isArray(manifest.migrations) || manifest.migrations.length < 42) {
  abort("Staging migration manifest is missing or incomplete");
}

function sqlFile(label, filename) {
  const rel = path.posix.normalize(filename);
  if (rel.startsWith("../") || path.isAbsolute(rel) || !rel.endsWith(".sql")) {
    throw new Error("Unsafe migration file path: " + label);
  }
  if (!fs.existsSync(rel)) throw new Error("Missing SQL file: " + rel);
  const child = spawnSync("psql", [databaseUrl, "-X", "-q", "-v", "ON_ERROR_STOP=1", "-f", rel], {
    encoding: "utf8", timeout: 120000, maxBuffer: 8 * 1024 * 1024
  });
  if (child.status !== 0 || child.error) throw new Error("SQL step failed (see isolated runner logs)");
}
const EXPECTED_RESTORED_LEDGER = [
  "20260924060622|security_hardening_phase1_20260924",
  "20260924060745|auth_profile_rls_minimal_20260924",
  "20260924061353|mvp_support_read_rls_20260924",
  "20260924061357|client_support_runtime_20260924",
  "20260924061403|admin_support_lifecycle_20260924",
  "20260925051259|public_intake_requests_mvp_20260925",
  "20260925051615|temporary_auth_bootstrap_token_store_20260925",
  "20260925051647|remove_unused_auth_bootstrap_token_store_20260925",
  "20260925052929|harden_public_intake_validation_20260925",
  "20260925053800|restore_audited_admin_intake_lifecycle_20260925",
  "20260928065214|client_stay_booking_atomic_v1",
  "20261007130434|010_fk_index_baseline",
  "20261007130525|006b_rls_initplan_scope_hardening",
  "20261007131749|006a_audit_log_write_lockdown",
  "20261007133920|order_booking_auth_uid_initplan_hardening",
  "20261007190013|client_onboarding_atomic_20261008",
  "20261007193325|support_queue_admin_read_20261008"
].sort();
function localStorageProvision() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  let u;
  try { u = new URL(supabaseUrl); } catch { throw new Error("Disposable Storage API URL absent"); }
  if (!["localhost", "127.0.0.1"].includes(u.hostname) || u.protocol !== "http:" ||
      u.port !== "54321" || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Storage provisioning requires local Supabase CLI and local service key");
  }
  const child = spawnSync("npm", ["run", "provision:catalog-media-bucket"], {
    encoding: "utf8", timeout: 60000, env: process.env
  });
  if (child.status !== 0) throw new Error("Local Storage provisioning failed");
}

function scalar(query) {
  const child = spawnSync("psql", [databaseUrl, "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", query], {
    encoding: "utf8", timeout: 15000
  });
  if (child.status !== 0) throw new Error("Baseline preflight SQL failed");
  return child.stdout.trim();
}
try {
  const actualLedger = scalar("select version || '|' || name from supabase_migrations.schema_migrations order by version, name").split("\n").filter(Boolean).sort();
  report.baselineMigrationRecordsObserved = actualLedger.length;
  report.baselineLedgerExactMatch = actualLedger.length === 17 &&
    actualLedger.every((row, index) => row === EXPECTED_RESTORED_LEDGER[index]);
  if (!report.baselineLedgerExactMatch) {
    abort("Restored migration ledger differs from all 17 audited version+name pairs");
  }
  sqlFile("preflight", "supabase/staging/000_preflight_read_only.sql");
} catch (error) { abort("Restored baseline preflight unavailable: " + error.message); }

for (const step of manifest.migrations) {
  const result = { id: step.id, apply: step.apply, verify: step.verify, status: "NOT_RUN" };
  report.checks.push(result);
  try {
    if (step.id === "009") localStorageProvision();
    sqlFile(step.id + " APPLY", step.apply);
    for (const verify of step.verify ?? []) sqlFile(step.id + " VERIFY", verify);
    result.status = "PASS";
  } catch (error) {
    result.status = "FAIL";
    result.reason = error.message;
    report.status = "FAIL";
    writeReport();
    console.error("KÖL migration " + step.id + ": FAIL");
    process.exit(1);
  }
}
for (const [id, filename] of [
  ["999", "supabase/staging/999_postflight_read_only.sql"],
  ["role_isolation", "supabase/staging/restored_role_isolation_TEST.sql"]
]) {
  const result = { id, apply: null, verify: [filename], status: "NOT_RUN" };
  report.checks.push(result);
  try { sqlFile(id, filename); result.status = "PASS"; }
  catch (error) { result.status = "FAIL"; result.reason = error.message; report.status = "FAIL"; writeReport(); process.exit(1); }
}
report.status = "PASS";
report.reason = report.planCountMismatch
  ? "All manifest steps passed; reconcile 44 current steps vs 42 historical request before any release"
  : "All staged steps and gates passed";
writeReport();
console.log("KÖL local restored migration rehearsal: PASS (" + report.checks.length + " gates); report " + reportFile);
