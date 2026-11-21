import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
const src=readFileSync("src/app/actions/admin/finance-costs.ts","utf8");
const page=readFileSync("src/app/admin/finance/costs/page.tsx","utf8");
const nav=readFileSync("src/components/layout/AdminLayout.tsx","utf8");
test("owner-only expense posting validates amount and approval reference",()=>{
 assert.match(src,/requireRole\(\["super_admin"\]\)/);
 assert.match(src,/p_approved_by:actor\.data\.userId/);
 assert.match(src,/amount\.test\(value\)/);
 assert.match(src,/p_original_id:original\|\|null/);
});
test("expense UI shows actual source, not demo profit",()=>{
 assert.match(page,/requireSuperAdmin\(\)/);
 assert.match(page,/kol_finance_cost_report_v1/);
 assert.match(page,/Чистая прибыль и оплата банка — Не подтверждено/);
 assert.match(page,/idempotency_key/);
 assert.match(page,/reversal:"\+x\.id/);
 assert.match(nav,/\/admin\/finance\/costs/);
});
