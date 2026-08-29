import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const base = process.env.KOL_QA_BASE_URL || "http://127.0.0.1:3100";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function assertSource(path, pattern, message) {
  if (!pattern.test(source(path))) throw new Error(message);
}

function assertSourceNot(path, pattern, message) {
  if (pattern.test(source(path))) throw new Error(message);
}

function auditSourceContracts() {
  assertSource(
    "src/lib/auth/role-home.ts",
    /isSafeInternalReturnPath/,
    "source: safe internal return-path helper is missing."
  );
  assertSource(
    "src/app/login/page.tsx",
    /isSafeInternalReturnPath/,
    "source: login does not validate return paths."
  );
  assertSourceNot(
    "src/app/order/success/page.tsx",
    /mockOrders|Demo order|Заказ создан в demo mode/i,
    "source: order success still exposes fake success data."
  );
  assertSourceNot(
    "src/app/booking/success/page.tsx",
    /mockBookings|Пример интерфейса/i,
    "source: booking success still exposes fake success data."
  );
  assertSource(
    "src/lib/data/admin-orders-read.ts",
    /productionRuntimeGuard/,
    "source: admin orders read does not use production runtime guard."
  );
  assertSource(
    "src/lib/data/admin-bookings-read.ts",
    /productionRuntimeGuard/,
    "source: admin bookings read does not use production runtime guard."
  );
}

async function auditBrowserContracts() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));

  try {
    for (const next of ["/stays/guest-house-bosteri-ui", "/tours/boat-trip-cholpon-ata", "/booking/checkout?bookingType=tour&tourId=tour-boat-cholpon-ata&guests=2"]) {
      await page.goto(`${base}/login?next=${encodeURIComponent(next)}`, { waitUntil: "domcontentloaded" });
      const hiddenNext = await page.locator('input[name="next"]').getAttribute("value");
      if (hiddenNext !== next) throw new Error(`browser: login page lost safe return target ${next}; got ${hiddenNext}`);
    }

    for (const unsafeNext of ["//evil.example", "https://evil.example", "/\\evil", "/unknown-private-area"]) {
      await page.goto(`${base}/login?next=${encodeURIComponent(unsafeNext)}`, { waitUntil: "domcontentloaded" });
      const hiddenNext = await page.locator('input[name="next"]').getAttribute("value");
      if (hiddenNext !== "/client") throw new Error(`browser: unsafe login return target was not rejected: ${unsafeNext} -> ${hiddenNext}`);
    }

    await page.goto(`${base}/order/success`, { waitUntil: "domcontentloaded" });
    const orderBody = await page.locator("body").innerText();
    if (!orderBody.includes("Заказ не был создан этой страницей")) throw new Error("browser: order success route does not fail safely.");
    if (/Заказ создан в demo mode|Demo order|Данные взяты из mockOrders/i.test(orderBody)) throw new Error("browser: order success route still exposes fake success data.");

    await page.goto(`${base}/booking/success`, { waitUntil: "domcontentloaded" });
    const bookingBody = await page.locator("body").innerText();
    if (!bookingBody.includes("Бронь не была создана этой страницей")) throw new Error("browser: booking success route does not fail safely.");
    if (/Пример интерфейса|mockBookings|Номер брони/i.test(bookingBody)) throw new Error("browser: booking success route still exposes unverified booking data.");

    await page.goto(`${base}/client/bookings`, { waitUntil: "domcontentloaded" });
    const clientBookingsBody = await page.locator("body").innerText();
    if (!clientBookingsBody.includes("Мои брони")) throw new Error("browser: client bookings page did not render.");
    if (/Demo cabinet|Данные взяты из mock/i.test(clientBookingsBody)) throw new Error("browser: client bookings list presents mock/demo data as production state.");

    await page.goto(`${base}/client/bookings/booking-stay-pending`, { waitUntil: "domcontentloaded" });
    const clientBookingDetailBody = await page.locator("body").innerText();
    if (!clientBookingDetailBody.includes("Не подтверждено")) throw new Error("browser: client booking detail must mark unknown financial fields as unconfirmed.");
    if (clientBookingDetailBody.includes("История статусов")) throw new Error("browser: client booking detail must not invent a booking status history.");

    await page.goto(`${base}/admin/orders`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Заказы", exact: true }).waitFor({ state: "visible" });
    await page.getByText("Контролируемые изменения", { exact: true }).waitFor({ state: "visible" });
    const adminOrdersBody = await page.locator("body").innerText();
    if (/client demo|Partner demo|Demo admin panel/i.test(adminOrdersBody)) throw new Error("browser: admin orders still exposes demo operational claims.");

    await page.goto(`${base}/admin/bookings`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Бронирования", exact: true }).waitFor({ state: "visible" });
    await page.getByText("Контролируемые изменения", { exact: true }).waitFor({ state: "visible" });
    const adminBookingsBody = await page.locator("body").innerText();
    if (/client demo|Demo admin panel/i.test(adminBookingsBody)) throw new Error("browser: admin bookings still exposes demo operational claims.");

    if (pageErrors.length) throw new Error(`browser: page errors: ${pageErrors.join(" | ")}`);
  } finally {
    await context.close();
    await browser.close();
  }
}

auditSourceContracts();
await auditBrowserContracts();
console.log("KÖL release safety audit: PASS");
