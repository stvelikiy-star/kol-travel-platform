import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error("admin-directory-contract: " + message);
}

const files = {
  users: read("src/app/admin/users/page.tsx"),
  clients: read("src/app/admin/clients/page.tsx"),
  couriers: read("src/app/admin/couriers/page.tsx"),
  moderation: read("src/app/admin/moderation/page.tsx")
};

// Never reintroduce fabricated directory data or legacy generic read adapters.
for (const [area, source] of Object.entries(files)) {
  for (const forbidden of [
    'from "@/lib/data/admin"',
    'from "@/lib/data/orders"',
    'from "@/lib/data/bookings"',
    'from "@/lib/data/partners"',
    'from "@/lib/data/delivery"',
    "@kol.demo", "+996 700", "Client demo", "Courier A demo",
    "Courier B demo", "Admin demo", "approved_demo", "hidden_demo",
    "Одобрить demo", "Заблокировать demo", "Назначить delivery demo"
  ]) {
    assert(!source.includes(forbidden), area + " includes forbidden demo/legacy source: " + forbidden);
  }
}

// Client and courier directories now read only scoped, real PostgreSQL profiles.
const roleReader = read("src/lib/data/admin-role-directory-supabase.ts");
assert(roleReader.includes("requireSuperAdmin()"), "role directories must enforce super_admin");
assert(roleReader.includes("isSupabaseMode()"), "role directories must reject mock reads");
assert(roleReader.includes('"client_profiles"'), "client profiles source is required");
assert(roleReader.includes('"courier_profiles"'), "courier profiles source is required");
assert(roleReader.includes('.from("user_profiles")'), "user contact details must come from authorized profiles");
assert(!/\.(insert|update|delete|upsert)\s*\(/.test(roleReader), "role directories must remain read only");

for (const [area, role] of [["clients", "client"], ["couriers", "courier"]]) {
  assert(files[area].includes("getAdminRoleDirectoryReadResult"), area + " must use real scoped reader");
  assert(files[area].includes('getAdminRoleDirectoryReadResult("' + role + '")'),
    area + " must request the correct scope");
  assert(files[area].includes("result.ok"), area + " must handle read failures");
  assert(!files[area].includes("<Button"), area + " must not expose unreviewed user actions");
}

// OWNER user directory is now a read-only, fail-closed Supabase implementation.
const userReader = read("src/lib/data/admin-user-directory-supabase.ts");
assert(files.users.includes("getAdminUserDirectoryReadResult"), "user directory must call verified Supabase reader");
assert(files.users.includes("result.ok"), "user directory must show an explicit read-failure state");
assert(userReader.includes("requireSuperAdmin()"), "user directory must enforce super_admin");
assert(userReader.includes("isSupabaseMode()"), "user directory must reject mock data");
assert(userReader.includes('.from("user_profiles")'), "user directory must read real PostgreSQL profiles");
assert(!/\.(insert|update|delete|upsert)\s*\(/.test(userReader), "user directory must not perform unreviewed writes");
assert(files.users.includes('method="get"'), "directory search must be read-only");

// Catalog moderation is operational only with a real Supabase queue and
// existing super_admin-guarded atomic moderation action.
const moderationReader = read("src/lib/data/admin-catalog-read.ts");
assert(files.moderation.includes("getAdminCatalogReviewQueueReadResult"), "moderation must use the real catalog queue");
assert(files.moderation.includes("requireSuperAdmin()"), "moderation must enforce super_admin");
assert(files.moderation.includes('result.source === "supabase"'), "moderation writes must be disabled for mock data");
assert(files.moderation.includes("AdminCatalogReviewQueue"), "moderation queue must be connected");
assert(moderationReader.includes("getAdminCatalogReviewQueueFromSupabase"), "real catalog reader missing");

// Courier incident path must remain scoped and deny forged authors.
const courierAction = read("src/app/actions/courier/courierDeliveryIssuesReal.ts");
const migration = fs.readdirSync("supabase/migrations")
  .filter(name => name.endsWith("_courier_delivery_issue_read_access.sql"))
  .map(name => read("supabase/migrations/" + name));
assert(migration.length === 1, "expected exactly one reviewed delivery issue RLS migration");
assert(courierAction.includes("requireCourier()"), "incident action must authenticate courier");
assert(courierAction.includes('rpc("get_courier_active_deliveries")'), "incident action must use scoped assignments");
assert(courierAction.includes('.from("delivery_issues").insert('), "incident action must write to real incident table");
assert(migration[0].includes("created_by = (SELECT auth.uid())"), "incident RLS must reject forged authors");
assert(migration[0].includes('TO authenticated'), "incident read policy must exclude anon");
console.log("KÖL admin directory, moderation and courier issue guards: PASS");
