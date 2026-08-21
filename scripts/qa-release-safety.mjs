import fs from "node:fs";
import { chromium } from "playwright";

const base = "http://127.0.0.1:3100";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function assertSource(condition, message) {
  if (!condition) throw new Error(`source: ${message}`);
}

function auditSourceContracts() {
  const permissions = read("src/lib/auth/permissions.ts");
  const guards = read("src/lib/auth/route-guards.ts");
  const ownerLayout = read("src/app/owner/layout.tsx");
  const authAction = read("src/app/actions/auth.ts");
  const loginPage = read("src/app/login/page.tsx");
  const loginRedirect = read("src/lib/auth/login-redirect.ts");
  const clientBookingActions = read("src/app/actions/client/clientBookingsReal.ts");
  const clientOrderActions = read("src/app/actions/client/clientOrdersReal.ts");
  const transactionRoleMigration = read("supabase/schema/008b_client_transaction_role_scope_DRAFT_NOT_APPLIED.sql");
  const stagingManifest = read("supabase/staging/migration-plan.json");
  const deploymentSafety = read("src/lib/deployment-safety.ts");
  const deploymentCheck = read("scripts/check-deployment-env.mjs");
  const orderSuccess = read("src/app/order/success/page.tsx");
  const bookingSuccess = read("src/app/booking/success/page.tsx");

  assertSource(/canAccessOwnerPanel[\s\S]*role === "super_admin"/.test(permissions), "Owner must be restricted to super_admin.");
  assertSource(/ProtectedArea = [^;]*"owner"/.test(guards), "Owner must be part of protected route areas.");
  assertSource(/protectRoute\("owner", "\/owner"\)/.test(ownerLayout), "Owner route must execute the server-side owner guard.");

  for (const prefix of ["/stays", "/tours", "/food", "/shop", "/booking"]) {
    assertSource(loginRedirect.includes(`"${prefix}"`), `Login return allowlist is missing ${prefix}.`);
  }
  assertSource(loginRedirect.includes('next.startsWith("//")'), "Login return sanitizer must reject protocol-relative paths.");
  assertSource(loginRedirect.includes('next.includes("\\\\")'), "Login return sanitizer must reject backslashes.");
  assertSource(authAction.includes("sanitizeLoginNextPath"), "Sign-in action must use the shared login redirect sanitizer.");
  assertSource(loginPage.includes("sanitizeLoginNextPath"), "Login page must use the same shared login redirect sanitizer.");

  assertSource(clientBookingActions.includes('import { requireClient }'), "Real booking actions must require the client role.");
  assertSource((clientBookingActions.match(/await requireClient\(\)/g) ?? []).length === 2, "Both real booking actions must enforce the client role.");
  assertSource(clientOrderActions.includes('await requireClient()'), "Real order action must enforce the client role.");
  assertSource(transactionRoleMigration.includes("enforce_active_client_transaction_identity"), "DB package must enforce client-role transaction identity.");
  assertSource(transactionRoleMigration.includes("ur.role = 'client'"), "DB transaction invariant must require active client role.");
  assertSource(stagingManifest.includes('"id":"008b"'), "Client-role transaction invariant must be in the staging migration plan.");

  assertSource(deploymentSafety.includes('KOL_PRODUCTION_RUNTIME_READY === "true"'), "Runtime must have an explicit production-readiness gate.");
  assertSource(deploymentSafety.includes('reason: "production_runtime_not_ready"'), "Unsafe production must expose the runtime-not-ready reason.");
  assertSource(deploymentCheck.includes("Production is blocked until KOL_PRODUCTION_RUNTIME_READY=true"), "Deployment preflight must reject unapproved production runtime.");

  assertSource(!orderSuccess.includes("mockOrders"), "Order success route must not render mock order data.");
  assertSource(!bookingSuccess.includes("mockBookings"), "Booking success route must not render mock booking data.");
}

async function auditBrowserContracts() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));

  try {
    for (const next of ["/stays/guest-house-bosteri-ui", "/tours/boat-trip-cholpon-ata"]) {
      await page.goto(`${base}/login?next=${encodeURIComponent(next)}`, { waitUntil: "domcontentloaded" });
      const hiddenNext = await page.locator('input[name="next"]').getAttribute("value");
      if (hiddenNext !== next) throw new Error(`browser: login page lost safe return target ${next}; got ${hiddenNext}`);
    }

    for (const unsafeNext of ["//evil.example", "/\\evil", "/unknown-private-area"]) {
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

    if (pageErrors.length) throw new Error(`browser: page errors: ${pageErrors.join(" | ")}`);
  } finally {
    await context.close();
    await browser.close();
  }
}

auditSourceContracts();
await auditBrowserContracts();
console.log("KÖL release safety audit: PASS");
