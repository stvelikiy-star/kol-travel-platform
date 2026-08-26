import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}
function assert(condition, message) {
  if (!condition) throw new Error(`public-live-read: ${message}`);
}

const publicPages = [
  ["home", "src/app/page.tsx"],
  ["stays", "src/app/stays/page.tsx"],
  ["food", "src/app/food/page.tsx"],
  ["shop", "src/app/shop/page.tsx"],
  ["food detail", "src/app/food/[restaurantSlug]/page.tsx"],
  ["shop detail", "src/app/shop/[shopSlug]/page.tsx"]
].map(([name, path]) => [name, path, read(path)]);

for (const [name, path, source] of publicPages) {
  assert(!source.includes('from "@/lib/data/catalog"'), `${name} (${path}) must not import the legacy generic catalog adapter.`);
  assert(!source.includes('from "@/lib/data/partners"'), `${name} (${path}) must not import the legacy generic partners adapter.`);
}

const home = read("src/app/page.tsx");
for (const reader of [
  "getPublicStaysReadResult",
  "getPublicToursReadResult",
  "getPublicFoodReadResult",
  "getPublicShopReadResult",
  "getPublicPartnersReadResult"
]) {
  assert(home.includes(reader), `Home must use ${reader}.`);
}
assert(!home.includes("getRooms()"), "Home must not reintroduce the legacy room read just for card capacity.");

const stays = read("src/app/stays/page.tsx");
assert(stays.includes("getPublicStaysReadResult"), "Stay catalog must use the public Stay reader.");
assert(!stays.includes("getRooms()"), "Stay catalog must not use the legacy room read.");

const food = read("src/app/food/page.tsx");
const foodDetail = read("src/app/food/[restaurantSlug]/page.tsx");
assert(food.includes("getPublicFoodReadResult") && food.includes("getPublicPartnersReadResult"), "Food catalog must join safe public food and partner reads.");
assert(foodDetail.includes("getPublicFoodReadResult") && foodDetail.includes("getPublicPartnersReadResult"), "Food detail must join safe public food and partner reads.");

const shop = read("src/app/shop/page.tsx");
const shopDetail = read("src/app/shop/[shopSlug]/page.tsx");
assert(shop.includes("getPublicShopReadResult") && shop.includes("getPublicPartnersReadResult"), "Shop catalog must join safe public shop and partner reads.");
assert(shopDetail.includes("getPublicShopReadResult") && shopDetail.includes("getPublicPartnersReadResult"), "Shop detail must join safe public shop and partner reads.");

for (const path of ["src/components/cards/FoodCard.tsx", "src/components/cards/ProductCard.tsx"]) {
  const source = read(path);
  assert(!source.includes('href="#"'), `${path} must not contain a dead hash link.`);
  assert(!source.includes(': "#"'), `${path} must not use a hash-link fallback.`);
  assert(source.includes('aria-disabled="true"'), `${path} must expose an accessible disabled state when a destination is unavailable.`);
}

const publicPartners = read("src/lib/data/public-partners-supabase.ts");
for (const sensitiveField of ["owner_user_id", "phone", "email", "address", "metadata"]) {
  assert(!publicPartners.includes(`"${sensitiveField}"`), `Public partner REST select must not include sensitive field ${sensitiveField}.`);
}
assert(publicPartners.includes('url.searchParams.set("status", "eq.approved")'), "Public partner read must remain approved-only.");
assert(publicPartners.includes('url.searchParams.set("type", "neq.alcohol_partner")'), "Public partner read must exclude the alcohol partner type.");

console.log("KÖL public live-read source audit: PASS");
