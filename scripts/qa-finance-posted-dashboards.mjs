import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
const a=readFileSync("src/app/admin/finance/page.tsx","utf8");
const p=readFileSync("src/app/partner/finance/page.tsx","utf8");
test("finance dashboards use distinct posted journal and provisional preview",()=>{
 assert.match(a,/readFinanceAdminJournalReport\(period\)/);
 assert.match(p,/readPartnerJournalReport\(period\)/);
 assert.match(a,/readFinanceAdminSettlementPreview\(period\)/);
 assert.match(p,/readPartnerSettlementPreview\(period\)/);
});
test("no fake payouts and bank settlement remain locked",()=>{
 assert.match(a,/Денежный расчёт с банком, фактические выплаты и чистая прибыль — Не подтверждено/);
 assert.match(p,/Выплаты и прибыль — Не подтверждено/);
 assert.match(a,/Рабочий финансовый источник истины ещё не подключён/);
 assert.match(p,/Finance locked/);
});
