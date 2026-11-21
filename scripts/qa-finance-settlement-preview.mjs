import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
const sql=readFileSync("ops/release-sql/kol-finance-contract-settlement-preview-v1-20261121.sql","utf8");
const src=readFileSync("src/lib/finance/settlement-preview.ts","utf8");
test("contract is owner-approved, immutable, scoped, and cannot overlap",()=>{
  assert.match(sql,/active_owner_approval_required/);
  assert.match(sql,/contract_append_only/);
  assert.match(sql,/overlapping_agreement_period/);
  assert.match(sql,/pg_advisory_xact_lock/);
  assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
  assert.match(sql,/REVOKE ALL ON public\.kol_finance_terms_v1 FROM PUBLIC,anon,authenticated,service_role/);
});
test("settlement is read-only, provider verified and blocked by refunds and duplicate paid records",()=>{
  assert.match(sql,/SECURITY INVOKER/);
  assert.match(sql,/private\.payment_provider_events/);
  assert.match(sql,/ev\.processing_status='applied'/);
  assert.match(sql,/paid_count=1/);
  assert.match(sql,/NOT has_refund/);
  assert.match(sql,/contract_count=1/);
  assert.match(sql,/verified_amount=gross/);
  assert.doesNotMatch(sql,/\b(UPDATE|DELETE FROM public\.payments|INSERT INTO public\.payouts)\b/);
});
test("no realized revenue or partner payable is invented",()=>{
  assert.match(sql,/'recognized_revenue',NULL/);
  assert.match(sql,/'actual_partner_payable',NULL/);
  assert.match(sql,/'profit',NULL/);
  assert.match(src,/recognized_revenue: null/);
});
test("owner, admin and partner have separate guarded server entrypoints",()=>{
  assert.match(src,/import "server-only"/);
  assert.match(src,/requireRole\(\["super_admin"\]\)/);
  assert.match(src,/requireRole\(\["super_admin","finance_admin"\]\)/);
  assert.match(src,/requireRole\(\["partner_owner","partner_manager"\]\)/);
  assert.match(src,/context\.businessId!==actor\.data\.partnerId/);
  assert.match(src,/return readPreview\(p,context\.businessId\)/);
  assert.doesNotMatch(src,/NEXT_PUBLIC_.*SERVICE_ROLE/);
});
