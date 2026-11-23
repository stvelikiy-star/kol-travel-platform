import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
const owner=readFileSync("src/app/owner/analytics/page.tsx","utf8");
const partner=readFileSync("src/app/partner/analytics/page.tsx","utf8");
const root=readFileSync("src/app/owner/page.tsx","utf8");
test("owner and partner dashboards use tenant-scoped operational analytics",()=>{
 assert.match(owner,/requireSuperAdmin\(\)/);
 assert.match(owner,/readOwnerOperationsAnalytics\(period\)/);
 assert.match(partner,/readPartnerOperationsAnalytics\(period\)/);
 assert.match(root,/\/owner\/analytics/);
});
test("no fabricated conversion, bank revenue or profit",()=>{
 assert.match(owner,/Маркетинговая конверсия и чистая прибыль — не подтверждены/);
 assert.match(partner,/Конверсия, посещаемость, источники трафика и чистая прибыль — Не подтверждено/);
 assert.doesNotMatch(owner,/createSupabaseServiceRoleClient/);
 assert.doesNotMatch(partner,/createSupabaseServiceRoleClient/);
});
