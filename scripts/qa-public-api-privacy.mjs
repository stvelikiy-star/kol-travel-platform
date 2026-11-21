import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
const s=readFileSync("ops/release-sql/kol-public-api-privacy-20261121.sql","utf8");
test("anonymous RLS stays independent from editorial checks",()=>{
 assert.match(s,/USING\(status='published'\)/);
 assert.match(s,/FOR SELECT TO authenticated USING\(private\.can_manage_content\(\)\)/);
 assert.doesNotMatch(s,/FOR SELECT TO anon,authenticated USING\([^;]*private\.can_manage_content\(\)/);
});
test("receipt and moderation evidence is excluded from public API",()=>{
 assert.match(s,/REVOKE SELECT ON public\.site_ad_campaigns FROM anon,authenticated/);
 assert.match(s,/REVOKE SELECT ON public\.listing_promotions FROM anon,authenticated/);
 assert.match(s,/REVOKE SELECT ON public\.reviews FROM authenticated/);
 assert.doesNotMatch(s,/GRANT SELECT\([^)]*(payment_evidence|paid_marked_by|source_evidence_url)/);
});
