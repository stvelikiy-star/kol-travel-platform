import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
const s=readFileSync("ops/release-sql/kol-stay-review-listing-id-20261121.sql","utf8");
test("stay booking rating is attached to parent stay listing, tour remains direct",()=>{
 assert.match(s,/SELECT rm\.stay_id INTO v_stay_id/);
 assert.match(s,/WHERE rm\.id=b\.object_id AND rm\.business_id=b\.business_id/);
 assert.match(s,/NEW\.target_id:=v_stay_id/);
 assert.match(s,/FROM public\.stays st/);
 assert.match(s,/NEW\.target_id:=b\.object_id/);
});
test("historical reviews protected and rating immutable",()=>{
 assert.match(s,/existing_stay_reviews_require_explicit_data_migration/);
 assert.match(s,/NEW\.source IS DISTINCT FROM OLD\.source/);
 assert.match(s,/NEW\.rating IS DISTINCT FROM OLD\.rating/);
});
