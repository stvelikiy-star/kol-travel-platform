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

// /food and /shop are compatibility routes. The canonical catalog is /delivery.
const delivery = read("src/app/delivery/page.tsx");
for (const reader of ["getPublicFoodReadResult", "getPublicShopReadResult", "getPublicPartnersReadResult"]) {
  assert(delivery.includes(reader), `Unified delivery must use ${reader}.`);
}
assert(delivery.includes("CartSummaryPreview"), "Unified delivery must display the shared cart.");
assert(delivery.includes("FoodCard") && delivery.includes("ProductCard"), "Unified delivery must render food and shop items.");
for (const [legacyPath, tab] of [["src/app/food/page.tsx", "food"], ["src/app/shop/page.tsx", "shop"]]) {
  const redirectSource = read(legacyPath);
  assert(redirectSource.includes('redirect(`/delivery?') && redirectSource.includes(`tab: "${tab}"`),
    `${legacyPath} must redirect to the correct unified delivery tab.`);
}
const foodDetail = read("src/app/food/[restaurantSlug]/page.tsx");
assert(foodDetail.includes("getPublicFoodReadResult") && foodDetail.includes("getPublicPartnersReadResult"), "Food detail must join safe public food and partner reads.");
const shopDetail = read("src/app/shop/[shopSlug]/page.tsx");
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

// Only approved and online partners may appear in the Supabase public catalog.
for (const path of ["src/lib/data/public-stays-supabase.ts", "src/lib/data/public-tours-supabase.ts"]) {
  const source = read(path);
  assert(source.includes('row.partners?.status === "approved"') &&
    source.includes('row.partners?.business_status === "online"'),
    `${path} must reject offers from unapproved or offline partners.`);
}

// Live catalog must never invent guest ratings or confirmed availability.
for (const path of ["src/lib/data/public-stays-supabase.ts", "src/lib/data/public-tours-supabase.ts"]) {
  const source = read(path);
  assert(source.includes("rating: toNumber(row.partners?.rating, 0)"),
    `${path} must not fabricate a 4.8-star rating without provider data.`);
}
const tourCard = read("src/components/cards/TourCard.tsx");
assert(tourCard.includes('availabilityLabel = "Доступность уточняется"'),
  "Tour card must not claim seats are available without live inventory.");
assert(tourCard.includes('tour.rating > 0') && tourCard.includes('tour.price > 0'),
  "Tour card must handle unverified rating and missing price transparently.");

// Supabase mode must never silently replace missing real tours with mock offers.
const publicTourReader = read("src/lib/data/public-tours-read.ts");
assert(!publicTourReader.includes("isShowcasePreview"),
  "Supabase tour reader must not fall back to showcase/mock offers.");
assert(publicTourReader.includes("if (!isSupabaseMode())") &&
  publicTourReader.includes("return createMockPublicToursReadResult()"),
  "Mock tours should remain available only when mock mode is explicitly selected.");

// Neither tour catalog nor tour detail may silently substitute mock entries in Supabase mode.
const tourDetail = read("src/lib/data/public-booking-detail-read.ts");
assert(!tourDetail.includes("isShowcasePreview"),
  "Real tour detail must not fall back to mock/showcase content.");
const stayDetail = read("src/app/stays/[slug]/page.tsx");
assert(stayDetail.includes('result.availability.some((slot) => slot.status === "available"'),
  "Live stay booking must require at least one confirmed available future date.");

const liveStayForm = read("src/components/booking/RealStayBookingPanel.tsx");
assert(liveStayForm.includes('slot.roomId === roomId && slot.status === "available"') &&
  liveStayForm.includes('!confirmed.has(day)'),
  "Live stay form must validate every requested night against confirmed inventory.");
assert(stayDetail.includes("availability={result.availability}"),
  "Live stay detail must pass real inventory dates to the booking form.");

// The public booking inventory must treat an available date with zero remaining
// rooms as sold out instead of allowing the client booking form to submit it.
const bookingInventoryReader = read("src/lib/data/public-booking-inventory-supabase.ts");
assert(bookingInventoryReader.includes('status === "available" && availableCount === 0 ? "booked" : status'),
  "Zero remaining inventory must not be exposed as an available room night.");

console.log("KÖL public live-read source audit: PASS");
