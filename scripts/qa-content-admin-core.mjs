import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const sql=readFileSync("ops/release-sql/kol-content-admin-core-20261121.sql","utf8");
const roles=readFileSync("src/lib/auth/roles.ts","utf8");
const types=readFileSync("src/lib/auth/types.ts","utf8");
test("content manager is recognized but is not an administrator",()=>{
 assert.match(roles,/"content_manager"/);assert.match(types,/"content_manager"/);
 const admin=roles.match(/export const adminRoles:[^\n]+/)[0];
 assert.doesNotMatch(admin,/content_manager/);
});
test("public reads exclude drafts and unpaid ads",()=>{
 assert.match(sql,/status='published' OR private.can_manage_content/);
 assert.match(sql,/payment_status='paid' AND paid_marked_by IS NOT NULL AND payment_evidence IS NOT NULL/);
 assert.match(sql,/label='ad'/);
 assert.match(sql,/CHECK\(price_kgs=0 OR NOT is_active/);
});
test("financial confirmation is super-admin only and audited",()=>{
 assert.match(sql,/r.role='super_admin'/);
 assert.match(sql,/payment_requires_super_admin/);
 assert.match(sql,/payment_evidence_required/);
 assert.match(sql,/INSERT INTO public.audit_logs/);
});
test("history, RLS, machine translation and no fake review creation",()=>{
 assert.match(sql,/site_content_history/);
 assert.match(sql,/machine_suggestion_not_accepted/);
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
 assert.doesNotMatch(sql,/\b(DROP TABLE|TRUNCATE TABLE|DELETE FROM public\.reviews)\b/i);
});
