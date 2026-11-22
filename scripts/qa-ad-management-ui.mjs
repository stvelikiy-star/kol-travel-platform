import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
const a=readFileSync("src/app/actions/admin/ads.ts","utf8");
const page=readFileSync("src/app/admin/ads/page.tsx","utf8");
const nav=readFileSync("src/components/layout/AdminLayout.tsx","utf8");
test("ad write server actions validate role, slot, date, URL and payment",()=>{
 assert.match(a,/requireRole\(\["super_admin","content_manager"\]\)/);
 assert.match(a,/requireRole\(\["super_admin","content_manager"\]\)/);
 assert.match(a,/payment_status:"pending"/);
 assert.match(a,/payment_status:"paid",payment_evidence:evidence/);
 assert.match(a,/createSupabaseServerClient\(\)/);
 assert.match(a,/value\+":00\+06:00"/);
});
test("ad workspace never pretends money moved or traffic was counted",()=>{
 assert.match(page,/requireSuperAdmin\(\)/);
 assert.match(page,/не создаёт бухгалтерскую выручку KÖL/);
 assert.match(page,/без подтверждённой телеметрии не считаются/);
 assert.match(nav,/\/admin\/ads/);
});
