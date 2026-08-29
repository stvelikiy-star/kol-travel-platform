import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(`finance-fail-closed: ${message}`);
}

const files = {
  admin: read("src/app/admin/finance/page.tsx"),
  partner: read("src/app/partner/finance/page.tsx"),
  courier: read("src/app/courier/earnings/page.tsx")
};

for (const [role, source] of Object.entries(files)) {
  assert(source.includes("Не подтверждено"), `${role} finance must show unknown values as unconfirmed.`);
  assert(!source.includes('from "@/lib/data/admin"'), `${role} finance must not use the legacy generic admin adapter.`);
  assert(!source.includes('from "@/lib/data/orders"'), `${role} finance must not derive money from generic orders.`);
  assert(!source.includes('from "@/lib/data/bookings"'), `${role} finance must not derive money from generic bookings.`);
  assert(!source.includes("formatMoney("), `${role} finance must not calculate display money without a ledger.`);
  assert(!source.includes("payout-demo"), `${role} finance must not invent payout records.`);
  assert(!source.includes("<Button"), `${role} finance must not expose unsupported financial action buttons.`);
}

const combined = Object.values(files).join("\n");
for (const forbidden of ["0.12", "0.78", "0.45", "GMV demo", "Выручка demo", "earnings demo", "paid_demo"]) {
  assert(!combined.includes(forbidden), `fabricated finance marker is forbidden: ${forbidden}`);
}

assert(
  files.admin.includes("Рабочий финансовый источник истины ещё не подключён"),
  "Admin finance must remain visibly locked until ledger readiness."
);
assert(files.partner.includes("Finance locked"), "Partner finance must remain visibly locked until ledger readiness.");
assert(files.courier.includes("Courier finance locked"), "Courier earnings must remain visibly locked until ledger readiness.");

console.log("KÖL finance fail-closed audit: PASS");
