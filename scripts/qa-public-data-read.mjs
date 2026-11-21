import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
const s=readFileSync("src/lib/data/site-content-read.ts","utf8");
test("backend public reads use real SSR Supabase and safe fallback",()=>{
 assert.match(s,/isSupabaseMode\(\)/);assert.match(s,/createSupabaseServerClient\(\)/);
 assert.match(s,/source:"fallback"/);assert.match(s,/\.eq\("status","published"\)/);
 assert.doesNotMatch(s,/getMock|createSupabaseServiceRoleClient/);
});
test("ads and promotion use server enforced active status",()=>{
 assert.match(s,/\.eq\("status","active"\)/);
 assert.match(s,/\.eq\("is_active",true\)/);
 assert.match(s,/safeAdUrl/);
 assert.match(s,/!value\.startsWith\("\/\/"\)/);
});
test("guest rating is independent from editorial or ad score",()=>{
 assert.match(s,/public_listing_ratings/);
 assert.doesNotMatch(s,/editorial_scores/);
 assert.match(s,/uuidPattern\.test/);
});
