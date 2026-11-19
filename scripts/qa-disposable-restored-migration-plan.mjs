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
function scalar(query) {
  const child = spawnSync("psql", [databaseUrl, "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", query], {
    encoding: "utf8", timeout: 15000
  });
  if (child.status !== 0) throw new Error("Baseline preflight SQL failed");
  return child.stdout.trim();
}
try {
  const recordCount = Number(scalar("select count(*) from supabase_migrations.schema_migrations"));
  report.baselineMigrationRecordsObserved = recordCount;
  if (recordCount !== 17) abort("Expected exactly 17 source migration records, observed " + recordCount);
  sqlFile("preflight", "supabase/staging/000_preflight_read_only.sql");
} catch (error) { abort("Restored baseline preflight unavailable: " + error.message); }

for (const step of manifest.migrations) {
  const result = { id: step.id, apply: step.apply, verify: step.verify, status: "NOT_RUN" };
  report.checks.push(result);
  try {
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
