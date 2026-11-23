import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const sql = readFileSync("ops/release-sql/kol-finance-analytics-read-v1-20261121.sql", "utf8");
const src = readFileSync("src/lib/finance/analytics.ts", "utf8");

test("read-only RPC denies browser roles", () => {
  assert.match(sql, /SECURITY INVOKER/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.kol_finance_analytics_v1\(date,date,uuid\) FROM PUBLIC, anon, authenticated/i);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.kol_finance_analytics_v1\(date,date,uuid\) TO service_role/i);
  assert.doesNotMatch(sql, /\b(INSERT|UPDATE|DELETE|TRUNCATE)\s+(INTO|public\.|FROM)\b/i);
  assert.match(sql, /p_to - p_from > 366/);
});

test("server validates OWNER and finance-admin roles", () => {
  assert.match(src, /import "server-only"/);
  assert.match(src, /requireRole\(\["super_admin"\]\)/);
  assert.match(src, /requireRole\(\["super_admin", "finance_admin"\]\)/);
});
test("PARTNER has JWT-derived scope, no arbitrary business", () => {
  assert.match(src, /requireRole\(\["partner_owner", "partner_manager"\]\)/);
  assert.match(src, /getAuthenticatedPartnerReadContext\(\)/);
  assert.match(src, /context\.businessId !== identity\.data\.partnerId/);
  assert.match(src, /return readScoped\(period, context\.businessId\)/);
  assert.doesNotMatch(src, /NEXT_PUBLIC_.*SERVICE_ROLE/i);
});
test("no fabricated profits or commission rate", () => {
  assert.match(sql, /'earned_amount',NULL/);
  assert.match(sql, /'net_platform_revenue','profit','partner_payable'/);
  assert.match(src, /validPeriod\(period\)/);
  assert.doesNotMatch(sql, /\b0\.1[025]\b/);
});
