import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(`courier-scope: ${message}`);
}

const files = {
  overview: read("src/app/courier/page.tsx"),
  deliveries: read("src/app/courier/deliveries/page.tsx"),
  detail: read("src/app/courier/deliveries/[id]/page.tsx"),
  active: read("src/app/courier/active/page.tsx"),
  history: read("src/app/courier/history/page.tsx"),
  issues: read("src/app/courier/issues/page.tsx"),
  dispatcher: read("src/app/courier/dispatcher/page.tsx"),
  profile: read("src/app/courier/profile/page.tsx"),
  earnings: read("src/app/courier/earnings/page.tsx"),
  operationalPanel: read("src/app/courier/_components/CourierOperationalFinalPanel.tsx"),
  escalationPanel: read("src/app/courier/_components/CourierIssueEscalationPanel.tsx"),
  scopedReader: read("src/lib/data/courier-deliveries-supabase.ts")
};

for (const area of ["overview", "deliveries", "detail", "active"]) {
  assert(files[area].includes("courier-deliveries-read"), `${area} must use the courier scoped read wrapper.`);
  assert(!files[area].includes('from "@/lib/data/orders"'), `${area} must not import generic orders.`);
  assert(!files[area].includes('from "@/lib/data/delivery"'), `${area} must not import generic delivery helpers.`);
}

for (const area of ["history", "issues", "dispatcher", "profile", "earnings"]) {
  assert(/locked|fail-closed|не подключ/i.test(files[area]), `${area} must remain visibly fail-closed until its backend exists.`);
  assert(!files[area].includes('from "@/lib/data/orders"'), `${area} must not use generic order data.`);
  assert(!files[area].includes('from "@/lib/data/delivery"'), `${area} must not use generic delivery data.`);
  assert(!files[area].includes('from "@/lib/data/admin"'), `${area} must not use generic admin demo data.`);
}

assert(!files.detail.includes("generateStaticParams"), "courier detail must not statically enumerate generic deliveries.");
assert(files.scopedReader.includes("requireCourier"), "Supabase courier reader must enforce courier role.");
assert(files.scopedReader.includes('courier_id", `eq.${config.userId}`'), "Supabase courier reader must scope assignments to authenticated user id.");
assert(files.scopedReader.includes("courier_assignments"), "Supabase courier reader must resolve courier assignments before orders.");

for (const area of ["operationalPanel", "escalationPanel"]) {
  assert(!files[area].includes("<Button"), `${area} must not expose unsupported action buttons.`);
}

const combined = Object.values(files).join("\n");
for (const forbidden of [
  "+996 700",
  "demo street",
  "partner pickup point",
  "Client demo",
  "Courier earning demo",
  "CourierActiveDemoActions",
  "CourierIssueDemoActions",
  "getDeliveryOrders",
  "getDeliveryByOrderId",
  "getAIRecommendationsDemo",
  "Accept delivery demo",
  "Отправить проблему demo",
  "Сохранить demo",
  "payout-demo",
  "Math.round(order.total * 0.08)",
  "5 minutes ->",
  "7 minutes ->",
  "3 minutes ->"
]) {
  assert(!combined.includes(forbidden), `fabricated or unsafe courier marker is forbidden: ${forbidden}`);
}

console.log("KÖL courier scope/fail-closed audit: PASS");
