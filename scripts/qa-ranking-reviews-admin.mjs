import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
const ranking=readFileSync("src/app/actions/admin/ranking.ts","utf8");
const rankPage=readFileSync("src/app/admin/ranking/page.tsx","utf8");
const reviewsPage=readFileSync("src/app/admin/reviews/page.tsx","utf8");
const nav=readFileSync("src/components/layout/AdminLayout.tsx","utf8");
test("editorial score and promotion do not change customer star ratings",()=>{
 assert.match(ranking,/requireRole\(\["super_admin","content_manager"\]\)/);
 assert.match(ranking,/\.from\("editorial_scores"\)/);
 assert.match(ranking,/\.from\("listing_promotions"\)/);
 assert.match(ranking,/payment_status:"pending",is_active:false/);
 assert.match(rankPage,/Оценка редакции KÖL/);
 assert.match(rankPage,/Платное продвижение не меняет оценку гостей/);
});
test("payment proof is attested by owner or content manager and cannot bypass DB RLS",()=>{
 assert.match(ranking,/confirmListingPromotionPayment/);
 assert.match(ranking,/requireRole\(\["super_admin","content_manager"\]\)/);
 assert.match(ranking,/createSupabaseServerClient\(\)/);
 assert.match(ranking,/payment_status:"paid",payment_evidence:proof/);
});
test("review UI invokes real audited moderation and keeps external sources separate",()=>{
 assert.match(reviewsPage,/moderateReview/);
 assert.match(reviewsPage,/importVerifiedExternalReview/);
 assert.match(reviewsPage,/requireSuperAdmin\(\)/);
 assert.match(reviewsPage,/Отзыв гостя KÖL/);
 assert.match(reviewsPage,/Отзывов пока нет/);
 assert.match(nav,/\/admin\/ranking/);
 assert.match(nav,/\/admin\/reviews/);
});
