const playwrightModule = process.env.KOL_PLAYWRIGHT_MODULE || "playwright";
const { chromium } = await import(playwrightModule);

const appBaseUrl = process.argv[2] || process.env.KOL_LOCAL_APP_BASE_URL;
const PASSWORD = "KolLocal!2026Auth";
const RUN_SUFFIX = String(
  process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT || "1"}`
    : `${Date.now()}-${process.pid}`
).replace(/[^a-zA-Z0-9-]/g, "-");
const email = `qa-client-${RUN_SUFFIX}@kol.test`;
const nextPath = "/stays/demo-guest-house";

if (!appBaseUrl) {
  throw new Error("Booking login diagnostics require the local application base URL.");
}

const appUrl = new URL(appBaseUrl);
if (appUrl.hostname !== "127.0.0.1" && appUrl.hostname !== "localhost") {
  throw new Error(`Refusing booking login diagnostics against non-local host: ${appUrl.hostname}`);
}

function normalizeText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

async function snapshot(page, label) {
  const headings = await page.locator("h1").allInnerTexts().catch(() => []);
  const bodyText = await page.locator("body").innerText().catch(() => "<body unavailable>");
  const title = await page.title().catch(() => "<title unavailable>");

  return {
    label,
    url: page.url(),
    title: normalizeText(title),
    h1: headings.map(normalizeText),
    body: normalizeText(bodyText).slice(0, 1200)
  };
}

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${appBaseUrl}/login?next=${encodeURIComponent(nextPath)}`, {
    waitUntil: "domcontentloaded"
  });
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await Promise.all([
    page.waitForURL((url) => url.pathname === nextPath, { timeout: 15000 }),
    page.locator('button[type="submit"]').click()
  ]);

  await page.waitForLoadState("domcontentloaded").catch(() => undefined);
  const afterServerAction = await snapshot(page, "after_server_action_redirect");

  await page.reload({ waitUntil: "domcontentloaded" });
  const afterReload = await snapshot(page, "after_authenticated_reload");

  console.error("KOL_BOOKING_LOGIN_BROWSER_DIAGNOSTICS", JSON.stringify({
    afterServerAction,
    afterReload
  }));

  await context.close();
} finally {
  await browser.close();
}
