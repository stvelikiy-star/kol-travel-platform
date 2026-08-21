import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const manifestPath = path.join(root, "supabase/staging/migration-plan.json");
const expectedOrder = [
  "005","005a","006","006a","006b","006c","006d","010","007","007a","007b",
  "008","008a","009","009a","011","011a","011b","011c","012","012a","012b"
];

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exitCode = 1;
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

if (!fs.existsSync(manifestPath)) {
  fail("supabase/staging/migration-plan.json is missing");
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const migrations = Array.isArray(manifest.migrations) ? manifest.migrations : [];
const ids = migrations.map((item) => item.id);

if (JSON.stringify(ids) !== JSON.stringify(expectedOrder)) {
  fail(`migration order mismatch: ${ids.join(" -> ")}`);
}

if (new Set(ids).size !== ids.length) {
  fail("duplicate migration IDs detected");
}

const applyPaths = migrations.map((item) => item.apply);
if (new Set(applyPaths).size !== applyPaths.length) {
  fail("duplicate migration apply paths detected");
}

for (const forbidden of manifest.forbidden ?? []) {
  if (typeof forbidden === "string" && forbidden.includes("004_minimal_additive_catalog_fields")) {
    // Explicit exclusion is required and therefore valid.
    continue;
  }
}

const accidentalStage21 = applyPaths.find((file) => file.includes("004_minimal_additive_catalog_fields"));
if (accidentalStage21) {
  fail(`Stage 21 / 004 must not be in the staging apply plan: ${accidentalStage21}`);
}

const accidentalCombined = applyPaths.find((file) => file.endsWith("combined_manual_setup.sql"));
if (accidentalCombined) {
  fail(`combined_manual_setup.sql must not be in the staging apply plan: ${accidentalCombined}`);
}

const requiredSupportFiles = [manifest.preflight, manifest.postflight].filter(Boolean);
for (const relative of requiredSupportFiles) {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) fail(`support file missing: ${relative}`);
}

console.log("KÖL staging execution package");
console.log(`Milestone: ${manifest.milestone}`);
console.log(`Mode: ${manifest.mode}`);
console.log(`Migrations: ${migrations.length}`);
console.log("");

for (const migration of migrations) {
  if (typeof migration.apply !== "string" || !migration.apply.includes("DRAFT_NOT_APPLIED")) {
    fail(`${migration.id}: apply file must remain explicitly DRAFT_NOT_APPLIED`);
    continue;
  }

  const applyAbsolute = path.join(root, migration.apply);
  if (!fs.existsSync(applyAbsolute)) {
    fail(`${migration.id}: missing apply file ${migration.apply}`);
    continue;
  }

  const applyHash = sha256(applyAbsolute);
  console.log(`${migration.id} APPLY  ${applyHash}  ${migration.apply}`);

  const verifyFiles = Array.isArray(migration.verify) ? migration.verify : [];
  if (verifyFiles.length === 0) {
    fail(`${migration.id}: at least one read-only VERIFY file is required`);
  }

  for (const verify of verifyFiles) {
    const verifyAbsolute = path.join(root, verify);
    if (!fs.existsSync(verifyAbsolute)) {
      fail(`${migration.id}: missing VERIFY file ${verify}`);
      continue;
    }
    console.log(`${migration.id} VERIFY ${sha256(verifyAbsolute)}  ${verify}`);
  }
}

if (process.exitCode) {
  console.error("Staging execution package: FAIL");
} else {
  console.log("");
  console.log("Staging execution package: PASS");
  console.log("No SQL executed. No network connection attempted. Hashes are SHA-256 of tracked files.");
}
