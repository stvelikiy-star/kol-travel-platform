import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
const source=readFileSync("src/lib/finance/requests-read.ts","utf8");
const client=readFileSync("src/app/client/finance/requests/page.tsx","utf8");
const partner=readFileSync("src/app/partner/finance/requests/page.tsx","utf8");
test("client sources are owner-scoped before privileged query",()=>{
 assert.match(source,/requireClient\(\)/);
 assert.match(source,/\.eq\("client_id",actor\.data\.clientId\)/);
 assert.match(source,/orderIds\.includes\(x\.order_id\)/);
 assert.match(source,/bookingIds\.includes\(x\.booking_id\)/);
});
test("partner sources are scoped to verified partner context",()=>{
 assert.match(source,/requireRole\(\["partner_owner","partner_manager"\]\)/);
 assert.match(source,/context\.businessId!==actor\.data\.partnerId/);
 assert.match(source,/\.eq\("business_id",context\.businessId\)/);
});
test("forms never claim transferred money",()=>{
 assert.match(client,/requireClient\(\)/);
 assert.match(partner,/requireRole\(\["partner_owner","partner_manager"\]\)/);
 assert.match(client,/Заявка зарегистрирована и ожидает решения\. Деньги не перечислены/);
 assert.match(partner,/Одобрение собственника не означает банковский перевод/);
 assert.match(client,/refund:"\+p\.id/);
 assert.match(partner,/payout:"\+row\.id/);
});
