import fs from "node:fs";
import assert from "node:assert/strict";
const manifest = JSON.parse(fs.readFileSync("supabase/staging/migration-plan.json","utf8"));
assert.ok(Array.isArray(manifest.migrations));
const seen=new Set();
for(const step of manifest.migrations){
  assert.ok(step.id && !seen.has(step.id), "duplicate or blank migration ID");
  seen.add(step.id);
  assert.match(step.apply,/DRAFT_NOT_APPLIED\.sql$/);
  assert.ok(fs.existsSync(step.apply),`missing ${step.id} draft: ${step.apply}`);
  assert.ok(step.verify?.length > 0,`missing ${step.id} verification`);
  for(const p of step.verify)assert.ok(fs.existsSync(p),`missing VERIFY for ${step.id}: ${p}`);
}
assert.ok(manifest.migrations.length >= 42,"canonical 42-step minimum missing");
assert.ok(fs.existsSync("supabase/staging/999_postflight_read_only.sql"));
assert.ok(fs.existsSync("supabase/staging/restored_role_isolation_TEST.sql"));
assert.ok(fs.existsSync("supabase/schema/027a_public_intake_atomic_ip_guard_DRAFT_NOT_APPLIED.sql"));
assert.ok(fs.existsSync("supabase/schema/027a_public_intake_atomic_ip_guard_VERIFY.sql"));
const runner=fs.readFileSync("scripts/run-local-supabase-staging-smoke.sh","utf8");
assert.match(runner,/127\.0\.0\.1:54322/);
assert.match(runner,/psql_file "\$\{id\} VERIFY"/);
assert.match(runner,/999_postflight_read_only/);
assert.match(runner,/restored_role_isolation_TEST/);
assert.match(runner,/qa-public-intake-atomic-disposable/);
console.log(`MIGRATION_PLAN_SOURCE_PASS: ${manifest.migrations.length} canonical steps + separate 027a; restored 17-migration baseline NOT VERIFIED until supplied`);
