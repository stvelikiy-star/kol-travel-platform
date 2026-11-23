import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
const sql=readFileSync("ops/release-sql/kol-review-insert-audit-20261121.sql","utf8");
const src=readFileSync("src/app/actions/admin/reviews.ts","utf8");
test("new source reviews and guest reviews are audited",()=>{
 assert.match(sql,/AFTER INSERT ON public\.reviews/);
 assert.match(sql,/private\.site_audit\(\)/);
});
test("guest creates only a pending own completed-booking review",()=>{
 assert.match(src,/requireClient\(\)/);assert.match(src,/if\(!actor\.ok/);
 assert.match(src,/client_id:actor\.data\.clientId/);
 assert.match(src,/booking_id:bookingId/);
 assert.match(src,/status:"new"/);
});
test("import requires verifiable source and moderator cannot replace author",()=>{
 assert.match(src,/requireRole\(\["super_admin","content_manager"\]\)/);
 assert.match(src,/source_evidence_url:evidenceUrl/);
 assert.match(src,/reasons\.has\(hiddenReason\)/);
 assert.match(src,/\.update\(\{status:decision/);
 assert.doesNotMatch(src,/\.update\(\{[^}]*rating/);
});
