import fs from "node:fs";
import path from "node:path";

const files = [
  "supabase/schema/000_RUN_ORDER.md",
  "supabase/schema/001_initial_schema.sql",
  "supabase/schema/002_rls_policies_draft.sql",
  "supabase/schema/003_seed_demo_data_draft.sql",
  "supabase/schema/003_seed_demo_data_draft_FIXED.sql",
  "supabase/schema/004_minimal_additive_catalog_fields_DRAFT_NOT_APPLIED.sql",
  "supabase/schema/005_security_hardening_DRAFT_NOT_APPLIED.sql",
  "supabase/schema/005_security_hardening_VERIFY.sql",
  "supabase/schema/006_rls_policy_completion_DRAFT_NOT_APPLIED.sql",
  "supabase/schema/006_rls_policy_completion_VERIFY.sql",
  "supabase/schema/combined_manual_setup.sql"
];

let missingCount = 0;

for (const file of files) {
  const filePath = path.join(process.cwd(), file);

  if (!fs.existsSync(filePath)) {
    console.log(`${file}: missing`);
    missingCount += 1;
    continue;
  }

  const stats = fs.statSync(filePath);
  console.log(`${file}: present (${stats.size} bytes)`);
}

if (missingCount > 0) {
  process.exitCode = 1;
}

console.log("No SQL executed. No Supabase connection attempted.");
