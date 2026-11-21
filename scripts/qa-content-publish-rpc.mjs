import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const rpc=readFileSync("ops/release-sql/kol-content-publish-rpc-20261121.sql","utf8");
const action=readFileSync("src/app/actions/admin/content.ts","utf8");
test("publishing locks draft and checks expected version",()=>{
 assert.match(rpc,/FOR UPDATE/);assert.match(rpc,/stale_or_missing_draft/);
 assert.match(rpc,/DELETE FROM public.site_content/);assert.match(rpc,/ON CONFLICT\(content_key,locale,status\)/);
});
test("publishing runs with caller RLS and explicit CMS role",()=>{
 assert.match(rpc,/SECURITY INVOKER/);assert.match(rpc,/private.can_manage_content\(\)/);
 assert.match(rpc,/REVOKE ALL ON FUNCTION/);assert.match(rpc,/GRANT EXECUTE ON FUNCTION .* TO authenticated/);
 assert.match(action,/requireRole\(\["super_admin","content_manager"\]\)/);
});
test("server action validates inputs, refreshes public pages and avoids service-role keys",()=>{
 assert.match(action,/keyPattern\.test\(key\)/);assert.match(action,/revalidatePath\("\/stays"\)/);
 assert.doesNotMatch(action,/createSupabaseServiceRoleClient/);
 assert.match(action,/createSupabaseServerClient/);
});
