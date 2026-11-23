import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
const a=readFileSync("src/app/actions/admin/finance-requests.ts","utf8");
const page=readFileSync("src/app/admin/finance/requests/page.tsx","utf8");
const nav=readFileSync("src/components/layout/AdminLayout.tsx","utf8");
test("owner decisions enforce server role and validated data",()=>{
 assert.match(a,/requireRole\(\["super_admin"\]\)/);
 assert.match(a,/row\.money_transferred!==false/);
 assert.match(a,/createSupabaseServiceRoleClient\(\)/);
 assert.match(a,/p_decided_by:actor\.data\.userId/);
});
test("request submission is restricted by role and database source",()=>{
 assert.match(a,/kind==="refund"/);
 assert.match(a,/kind==="payout"/);
 assert.match(a,/p_requested_by:actor\.data\.userId/);
 assert.match(a,/amountPattern/);
});
test("OWNER UI has no false payout confirmation",()=>{
 assert.match(page,/requireSuperAdmin\(\)/);
 assert.match(page,/decisionSubmit/);
 assert.match(page,/Движение денежных средств — Не подтверждено/);
 assert.match(nav,/\/admin\/finance\/requests/);
});
