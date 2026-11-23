import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const sql=readFileSync("ops/release-sql/kol-verified-reviews-20261121.sql","utf8");
test("review cannot switch source or identity to rewrite guest rating",()=>{
 assert.match(sql,/NEW\.source IS DISTINCT FROM OLD\.source/);
 assert.match(sql,/NEW\.rating IS DISTINCT FROM OLD\.rating/);
 assert.match(sql,/NEW\.text IS DISTINCT FROM OLD\.text/);
 assert.match(sql,/NEW\.target_id IS DISTINCT FROM OLD\.target_id/);
 assert.match(sql,/review_content_immutable/);
});
test("guest owns completed booking and target is derived by server",()=>{
 assert.match(sql,/auth\.uid\(\) IS NULL/);
 assert.match(sql,/b\.status<>'completed'/);
 assert.match(sql,/NEW\.target_type:=b\.booking_type;NEW\.target_id:=b\.object_id/);
 assert.match(sql,/reviews_one_per_booking_idx/);
});
test("paid advertising does not influence verified guest stars",()=>{
 assert.match(sql,/security_invoker=true/);
 assert.match(sql,/status='published' AND source='site'/);
 assert.match(sql,/source_evidence_url/);
 assert.match(sql,/review_import_evidence_required/);
 assert.match(sql,/reviews_moderation_audit/);
});
