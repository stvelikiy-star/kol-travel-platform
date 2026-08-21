import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}
function assert(condition, message) {
  if (!condition) throw new Error(`role-live-read: ${message}`);
}

const client = read("src/app/client/page.tsx");
const clientBookings = read("src/lib/data/client-bookings-supabase.ts");
const partner = read("src/app/partner/page.tsx");
const courier = read("src/app/courier/page.tsx");
const admin = read("src/app/admin/page.tsx");
const adminOrders = read("src/app/admin/orders/page.tsx");
const adminBookings = read("src/app/admin/bookings/page.tsx");
const adminPartners = read("src/app/admin/partners/page.tsx");
const adminBookingsAdapter = read("src/lib/data/admin-bookings-supabase.ts");
const adminPartnersAdapter = read("src/lib/data/admin-partners-supabase.ts");
const owner = read("src/app/owner/page.tsx");
const ownerLayout = read("src/app/owner/layout.tsx");
const courierAdapter = read("src/lib/data/courier-deliveries-supabase.ts");
const partnerOrdersAdapter = read("src/lib/data/partner-orders-supabase.ts");

assert(client.includes("getClientOrdersReadResult"), "Client dashboard must use scoped client order reads.");
assert(client.includes("getClientBookingsReadResult"), "Client dashboard must use scoped client booking reads.");
assert(clientBookings.includes("requireClient"), "Client booking adapter must require client role.");
assert(clientBookings.includes("config.userId !== client.data.clientId"), "Client booking adapter must verify client identity.");

assert(partner.includes("getPartnerOrdersReadResult"), "Partner dashboard must use scoped partner order reads.");
assert(!partner.includes('getPartnerOrders } from "@/lib/data/orders"'), "Partner dashboard must not use legacy generic orders.");
assert(partnerOrdersAdapter.includes("requirePartner"), "Partner order adapter must require partner role.");

assert(courier.includes("getCourierDeliveriesReadResult"), "Courier dashboard must use assigned courier delivery reads.");
assert(!courier.includes('getDeliveryOrders } from "@/lib/data/orders"'), "Courier dashboard must not read the generic delivery order list.");
assert(courierAdapter.includes("requireCourier"), "Courier delivery adapter must require courier role.");

for (const source of [admin, owner]) {
  assert(source.includes("getAdminDeliveryReadResult"), "Admin/Owner dashboard must use scoped admin order reads.");
  assert(source.includes("getAdminBookingsReadResult"), "Admin/Owner dashboard must use scoped admin booking reads.");
  assert(source.includes("getAdminPartnersReadResult"), "Admin/Owner dashboard must use scoped admin partner reads.");
  assert(!source.includes("getAdminDashboardData"), "Admin/Owner dashboard must not use generic dashboard data.");
  assert(!source.includes("getAdminOrders"), "Admin/Owner dashboard must not use generic orders.");
  assert(!source.includes("getAdminBookings"), "Admin/Owner dashboard must not use generic bookings.");
}
assert(ownerLayout.includes('protectRoute("owner", "/owner")'), "Owner route must keep the super-admin route guard.");
assert(adminBookingsAdapter.includes("requireAdmin"), "Admin booking adapter must require admin role.");
assert(adminPartnersAdapter.includes("requireAdmin"), "Admin partner adapter must require admin role.");

assert(adminOrders.includes("getAdminDeliveryReadResult"), "Admin orders page must use scoped reads.");
assert(adminBookings.includes("getAdminBookingsReadResult"), "Admin bookings page must use scoped reads.");
assert(adminPartners.includes("getAdminPartnersReadResult"), "Admin partners page must use scoped reads.");
assert(!/index\s*%/.test(adminOrders), "Admin orders must not invent risk from array position.");
assert(!/index\s*%/.test(adminBookings), "Admin bookings must not invent risk from array position.");
assert(!/index\s*%/.test(adminPartners), "Admin partners must not invent stop state from array position.");
assert(!adminBookings.includes('"2026-07-01"'), "Admin bookings must not hard-code today.");
assert(!/Demo admin panel|client demo|Partner demo|Остановленные demo/i.test(`${adminOrders}\n${adminBookings}\n${adminPartners}`), "Admin operational pages must not present demo claims as live state.");

console.log("KÖL five-role live-read audit: PASS");
