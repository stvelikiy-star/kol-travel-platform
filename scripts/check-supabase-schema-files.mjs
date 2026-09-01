import fs from "node:fs";
import path from "node:path";

const files = [
  "supabase/schema/001_initial_schema.sql",
  "supabase/schema/002_rls_policies_draft.sql",
  "supabase/schema/003_seed_demo_data_draft.sql",
  "supabase/schema/005_security_hardening_DRAFT_NOT_APPLIED.sql",
  "supabase/schema/005_security_hardening_VERIFY.sql",
  "supabase/schema/005a_partner_policy_scope_DRAFT_NOT_APPLIED.sql",
  "supabase/schema/006_rls_policy_completion_DRAFT_NOT_APPLIED.sql",
  "supabase/schema/006_rls_policy_completion_VERIFY.sql",
  "supabase/schema/006a_audit_log_write_lockdown_DRAFT_NOT_APPLIED.sql",
  "supabase/schema/006a_audit_log_write_lockdown_VERIFY.sql",
  "supabase/schema/006b_rls_initplan_scope_hardening_DRAFT_NOT_APPLIED.sql",
  "supabase/schema/006c_transaction_entrypoint_lockdown_DRAFT_NOT_APPLIED.sql",
  "supabase/schema/006d_api_role_privilege_hardening_DRAFT_NOT_APPLIED.sql",
  "supabase/schema/006d_api_role_privilege_hardening_VERIFY.sql",
  "supabase/schema/010_fk_index_baseline_DRAFT_NOT_APPLIED.sql",
  "supabase/schema/010_fk_index_baseline_VERIFY.sql",
  "supabase/schema/007_booking_transaction_core_DRAFT_NOT_APPLIED.sql",
  "supabase/schema/007_booking_transaction_core_VERIFY.sql",
  "supabase/schema/007a_booking_direct_write_lockdown_DRAFT_NOT_APPLIED.sql",
  "supabase/schema/007a_booking_direct_write_lockdown_VERIFY.sql",
  "supabase/schema/007b_booking_idempotency_serialization_DRAFT_NOT_APPLIED.sql",
  "supabase/schema/007b_booking_idempotency_serialization_VERIFY.sql",
  "supabase/schema/008_order_transaction_core_DRAFT_NOT_APPLIED.sql",
  "supabase/schema/008_order_transaction_core_VERIFY.sql",
  "supabase/schema/008a_order_idempotency_payload_hardening_DRAFT_NOT_APPLIED.sql",
  "supabase/schema/008a_order_idempotency_payload_hardening_VERIFY.sql",
  "supabase/schema/009_catalog_media_storage_DRAFT_NOT_APPLIED.sql",
  "supabase/schema/009_catalog_media_storage_VERIFY.sql",
  "supabase/schema/011_payment_integrity_DRAFT_NOT_APPLIED.sql",
  "supabase/schema/011_payment_integrity_VERIFY.sql",
  "supabase/schema/011a_payment_event_replay_conflict_guard_DRAFT_NOT_APPLIED.sql",
  "supabase/schema/011b_payment_projection_hardening_DRAFT_NOT_APPLIED.sql",
  "supabase/schema/011b_payment_projection_hardening_VERIFY.sql",
  "supabase/schema/012_delivery_lifecycle_DRAFT_NOT_APPLIED.sql",
  "supabase/schema/012_delivery_lifecycle_VERIFY.sql",
  "supabase/schema/012a_delivery_assignment_consistency_DRAFT_NOT_APPLIED.sql",
  "supabase/schema/012b_delivery_role_consistency_hardening_DRAFT_NOT_APPLIED.sql",
  "supabase/schema/012b_delivery_role_consistency_hardening_VERIFY.sql",
  "supabase/schema/016_partner_stop_runtime_DRAFT_NOT_APPLIED.sql",
  "supabase/schema/016_partner_stop_runtime_VERIFY.sql",
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
