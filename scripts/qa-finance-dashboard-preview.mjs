import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
const owner=readFileSync("src/app/admin/finance/page.tsx","utf8");
const partner=readFileSync("src/app/partner/finance/page.tsx","utf8");
const period=readFileSync("src/lib/finance/report-period.ts","utf8");
test("finance admin and partner pages use role-scoped backend reports",()=>{
 assert.match(owner,/readFinanceAdminSettlementPreview\(period\)/);
 assert.match(partner,/readPartnerSettlementPreview\(period\)/);
 assert.doesNotMatch(owner,/createSupabaseServiceRoleClient/);
 assert.doesNotMatch(partner,/createSupabaseServiceRoleClient/);
});
test("unavailable financial data never becomes recognized profit",()=>{
 assert.match(owner,/Прибыль, признанная выручка, задолженность и реальные выплаты не подтверждены/);
 assert.match(partner,/не подтверждённая сумма к выплате/);
 assert.match(owner,/preview\.ok/);assert.match(partner,/preview\.ok/);
});
test("report uses Kyrgyzstan month boundaries",()=>{
 assert.match(period,/Asia\/Bishkek/);
 assert.match(period,/toExclusive/);
});
