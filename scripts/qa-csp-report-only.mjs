// Report-only CSP browser check against local preview only; no live endpoints.
import { chromium } from "./playwright-qa.mjs";
import { mkdirSync, writeFileSync } from "node:fs";

const base = process.env.KOL_LOCAL_VISUAL_QA_URL ?? "http://127.0.0.1:3100";
const u = new URL(base);
if (u.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(u.hostname)) {
  throw new Error("Refusing non-local CSP test origin");
}
const routes = ["/", "/stays", "/tours", "/checkout", "/booking/checkout",
  "/team", "/admin", "/owner", "/partner", "/courier", "/kol-stage/scene.html"];
const browser = await chromium.launch({ headless: true });
const violations = [];
const failures = [];
const inspected = [];
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.exposeBinding("__kolCspRecord", (source, detail) => {
    violations.push({ frame: source.frame.url(), ...detail });
  });
  await context.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", event => {
      // Record only browser-supplied rule metadata, never page data or secrets.
      window.__kolCspRecord?.({
        directive: event.effectiveDirective,
        disposition: event.disposition,
        blockedOrigin: (() => {
          try { return new URL(event.blockedURI).origin; } catch { return event.blockedURI.slice(0, 100); }
        })()
      });
    });
  });
  for (const route of routes) {
    const page = await context.newPage();
    try {
      const response = await page.goto(base + route, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(900);
      if (!response || response.status() !== 200) {
        failures.push(route + ": expected HTTP 200, got " + response?.status());
        continue;
      }
      const headers = response.headers();
      const reportOnly = headers["content-security-policy-report-only"] ?? "";
      const enforcing = headers["content-security-policy"] ?? "";
      if (!reportOnly.includes("default-src 'self'") ||
          !reportOnly.includes("https://fonts.googleapis.com") ||
          !reportOnly.includes("https://*.supabase.co") ||
          !reportOnly.includes("frame-src 'self'") ||
          !reportOnly.includes("https://fonts.gstatic.com")) {
        failures.push(route + ": missing expected CSP report-only sources");
      }
      if (route === "/kol-stage/scene.html") {
        if (!enforcing.includes("frame-ancestors 'self'")) failures.push(route + ": scene cannot be safely embedded");
      } else if (enforcing.includes("default-src")) {
        failures.push(route + ": enforcing CSP activated prematurely");
      }
      if (headers["strict-transport-security"]) failures.push(route + ": unexpected HSTS over local HTTP");
      const body = await page.locator("body").innerText();
      if (body.trim().length < 15) failures.push(route + ": empty view");
      inspected.push({ route, status: response.status(), reportOnly: Boolean(reportOnly),
        explicitFrameAncestors: route === "/kol-stage/scene.html" ? enforcing : "not_scene" });
    } catch (error) {
      failures.push(route + ": " + String(error));
    } finally { await page.close(); }
  }
  // Actual report-only violations signal that enforced policy would break scripts,
  // fonts, navigation, images or scene when enabled. Never silently ignore them.
  for (const event of violations) {
    if (event.disposition === "report" && /^(script-src|style-src|connect-src|font-src|img-src|frame-src|worker-src)/.test(event.directive)) {
      failures.push("CSP " + event.directive + " " + event.blockedOrigin + " at " + event.frame);
    }
  }
  await context.close();
} finally { await browser.close(); }
mkdirSync("visual-artifacts", { recursive: true });
writeFileSync("visual-artifacts/csp-report-only.json", JSON.stringify({
  status: failures.length ? "FAIL" : "PASS",
  origin: base, inspected, violations, failures
}, null, 2) + "\n");
console.log("KÖL CSP report-only local browser QA:", failures.length ? "FAIL" : "PASS",
  "routes", inspected.length, "violations", violations.length);
if (failures.length) {
  console.error(JSON.stringify(failures.slice(0, 40), null, 2));
  process.exitCode = 1;
}
