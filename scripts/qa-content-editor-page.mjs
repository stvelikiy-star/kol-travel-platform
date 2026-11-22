import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
const page=readFileSync("src/app/admin/content/page.tsx","utf8");
const nav=readFileSync("src/components/layout/AdminLayout.tsx","utf8");
test("content editor has real server actions and role protection",()=>{
 assert.match(page,/requireRole\(\["super_admin",\s*"content_manager"\]\);\s*if\s*\(!actor\.ok\)\s*redirect\("\/not-authorized"\)/);
 assert.match(page,/action=\{saveAndReturn\}/);
 assert.match(page,/action=\{publishAndReturn\}/);
 assert.match(page,/action=\{restoreAndReturn\}/);
 assert.match(nav,/\/admin\/content/);
});
test("unavailable source is not replaced with fake data",()=>{
 assert.match(page,/const available = Boolean\(supabase/);
 assert.match(page,/Существующие страницы сайта остаются без изменений/);
 assert.doesNotMatch(page,/getMock/);
});
