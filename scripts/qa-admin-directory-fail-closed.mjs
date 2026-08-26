import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(`admin-fail-closed: ${message}`);
}

const files = {
  users: read("src/app/admin/users/page.tsx"),
  clients: read("src/app/admin/clients/page.tsx"),
  couriers: read("src/app/admin/couriers/page.tsx"),
  moderation: read("src/app/admin/moderation/page.tsx")
};

for (const [area, source] of Object.entries(files)) {
  assert(/locked/i.test(source), `${area} must remain visibly locked until its backend reader/action contract exists.`);
  assert(!source.includes("<Button"), `${area} must not expose unsupported operational action buttons.`);
  assert(!source.includes('from "@/lib/data/admin"'), `${area} must not use the legacy generic admin adapter.`);
  assert(!source.includes('from "@/lib/data/orders"'), `${area} must not use generic order data as operational truth.`);
  assert(!source.includes('from "@/lib/data/bookings"'), `${area} must not use generic booking data as operational truth.`);
  assert(!source.includes('from "@/lib/data/partners"'), `${area} must not use generic partner data as directory truth.`);
  assert(!source.includes('from "@/lib/data/delivery"'), `${area} must not use generic delivery data as courier-directory truth.`);
}

const combined = Object.values(files).join("\n");
for (const forbidden of [
  "@kol.demo",
  "+996 700",
  "Client demo",
  "Courier A demo",
  "Courier B demo",
  "Admin demo",
  "approved_demo",
  "hidden_demo",
  "Одобрить demo",
  "Заблокировать demo",
  "Назначить delivery demo"
]) {
  assert(!combined.includes(forbidden), `fabricated admin marker is forbidden: ${forbidden}`);
}

assert(files.users.includes("User directory locked"), "Users page must fail closed.");
assert(files.clients.includes("Client directory locked"), "Clients page must fail closed.");
assert(files.couriers.includes("Courier directory locked"), "Couriers page must fail closed.");
assert(files.moderation.includes("Moderation locked"), "Moderation page must fail closed.");

console.log("KÖL admin directory/moderation fail-closed audit: PASS");
