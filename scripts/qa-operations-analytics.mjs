import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
const sql=readFileSync("ops/release-sql/kol-operations-analytics-v1-20261121.sql","utf8");
const ts=readFileSync("src/lib/analytics/operations.ts","utf8");
test("data is tenant-scoped from real orders, bookings, deliveries",()=>{
 assert.match(sql,/FROM public\.orders o/);
 assert.match(sql,/FROM public\.bookings b/);
 assert.match(sql,/public\.deliveries d JOIN public\.orders/);
 assert.match(sql,/p_business_id IS NULL OR o\.business_id=p_business_id/);
 assert.match(sql,/Asia\/Bishkek/);
});
test("no invented traffic, marketing attribution, SLA or profit",()=>{
 assert.match(sql,/'conversion_rate',NULL/);
 assert.match(sql,/'marketing_attribution',NULL/);
 assert.match(sql,/'profit',NULL/);
 assert.match(sql,/'sla_minutes',NULL/);
});
test("authorized roles are checked and partner cannot select another scope",()=>{
 assert.match(ts,/requireRole\(\["super_admin"\]\)/);
 assert.match(ts,/requireRole\(\["partner_owner","partner_manager"\]\)/);
 assert.match(ts,/ctx\.businessId!==actor\.data\.partnerId/);
 assert.match(ts,/return read\(p,ctx\.businessId\)/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.kol_operations_analytics_v1/);
});
