import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const s=readFileSync("ops/release-sql/kol-ad-payment-immutability-20261121.sql","utf8");
test("locked paid advertising prevents changes to amounts or payment evidence",()=>{
 for(const c of ["payment_status","price_kgs","payment_evidence","paid_marked_by","paid_marked_at"])
  assert.match(s,new RegExp("NEW\\."+c+" IS DISTINCT FROM OLD\\."+c));
 assert.match(s,/paid_ad_financial_identity_immutable/);
});
test("paid status always needs owner and proof",()=>{
 assert.match(s,/private\.can_confirm_content_payment\(\)/);
 assert.match(s,/payment_evidence_required/);
 assert.match(s,/NEW\.paid_marked_by:=auth\.uid\(\)/);
 assert.match(s,/REVOKE ALL ON FUNCTION private\.ad_payment_before/);
});
