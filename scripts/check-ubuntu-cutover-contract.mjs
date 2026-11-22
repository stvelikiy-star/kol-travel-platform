// Static Ubuntu/PostgreSQL 17 cutover guard. This NEVER connects to a DB,
// claims a successful restore, or executes migrations.
import fs from "node:fs";

const load = (path) => fs.readFileSync(path, "utf8");
const assert = (condition, reason) => { if (!condition) throw new Error(`ubuntu-cutover: ${reason}`); };
const manifest = JSON.parse(load("supabase/staging/migration-plan.json"));
const config = load("supabase/config.toml");
const operations = load("ops/ubuntu/DATABASE_CUTOVER_PLAN.md");
const preview = load("ops/ubuntu/compose.yaml");
const writer = load("src/lib/data/booking-write-supabase.ts");
const inventory = load("supabase/schema/006e_public_booking_inventory_read_DRAFT_NOT_APPLIED.sql");
const deployment = load("src/lib/deployment-safety.ts");

assert(/^major_version\s*=\s*17\s*$/m.test(config), "source-compatible PostgreSQL 17 is required");
assert(operations.includes("supabase_vault 0.3.1"), "record the source-only extension dependency");
assert(Array.isArray(manifest.migrations) && manifest.migrations.length === 44,
  "the reviewed migration manifest must keep all 44 ordered steps");
assert(manifest.mode === "staging-only-reviewed-manual-apply", "migration policy must stay staging-only");
assert(manifest.migrations.some((m) => m.id === "006e" && m.apply.includes("006e_public_booking_inventory_read")),
  "public inventory RPC migration is missing");
assert(manifest.migrations.at(-1)?.id === "027",
  "public intake payload must follow the partner inventory publication migration");
for (const m of manifest.migrations) {
  assert(fs.existsSync(m.apply), `missing APPLY ${m.id}`);
  assert(m.apply.includes("DRAFT_NOT_APPLIED"), `unreviewed APPLY ${m.id}`);
  assert(m.verify?.length > 0, `missing VERIFY ${m.id}`);
  for (const file of m.verify) assert(fs.existsSync(file), `missing VERIFY ${file}`);
}
assert((inventory.match(/partner\.status = 'approved'/g) ?? []).length === 2 &&
  (inventory.match(/partner\.business_status = 'online'/g) ?? []).length === 2,
  "public Stay/Tour inventory must exclude suspended or offline partners");
assert(writer.includes("/rpc/client_stay_booking_create_atomic") &&
  writer.includes("/rpc/get_public_stay_inventory"),
  "current booking must retain the existing atomic writer and RLS-safe inventory projection");
assert(!writer.includes('readAuthenticatedRows(config, "room_availability"'),
  "client booking must not directly access partner-scoped availability");
assert(preview.includes("DATA_SOURCE_MODE: mock") &&
  preview.includes('KOL_PRODUCTION_RUNTIME_READY: "false"'),
  "Ubuntu mock preview must not silently become a real database deployment");
// Ubuntu was the 2026-10 release target. The November launch uses managed
// cloud Supabase. Preserve the legacy contract, but accept a reviewed cloud
// cutover only when its independent JWT, recovery and intake gates are PASS.
const cloud = JSON.parse(load("ops/cloud/PRODUCTION_CUTOVER_GATE.json"));
assert(cloud.target === "supabase-managed-production" &&
  cloud.projectRef === "sggajelagfonzpovnsiz", "unrecognized cloud Production target");
const checks = cloud.evidence || {};
const cloudCoreProof = [
  "schemaAndEmptyBaseline",
  "productionSecretReadOnlyProbe",
  "productionOwnerSignIn",
  "qaReleaseRegressionSuite"
].every((key) => checks[key] === "pass");
const cloudCanary = cloud.readinessDecision === "canary" && cloudCoreProof &&
  cloud.notes?.includes("Public DNS kol.on.kg stays on the old Hoster IP");
const cloudGo = cloud.readinessDecision === "go" && cloudCoreProof &&
  [
    "productionMultiRoleJwtE2e",
    "independentProductionBackupRestore",
    "publicIntakeLiveWriteAndIdempotency",
    "dnsHttpsCutover"
  ].every((key) => checks[key] === "pass");
assert(cloudCanary || cloudGo || deployment.includes("PRODUCTION_RUNTIME_IMPLEMENTATION_READY = false"),
  "Production implementation must remain blocked unless cloud canary or verified cutover is approved");
for (const marker of ["restore", "auth.uid()", "off Ubuntu", "PostgreSQL"]) {
  assert(operations.includes(marker), `cutover plan must describe ${marker}`);
}
console.log("KÖL Ubuntu cutover static contract: PASS");
console.log("44 migration APPLY/VERIFY entries are present; PostgreSQL 17 requirement and guards verified.");
console.log("NO SQL compatibility rehearsal, backup, restore, role E2E or Ubuntu runtime check was performed.");
