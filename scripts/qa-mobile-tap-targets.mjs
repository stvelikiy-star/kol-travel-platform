// Browser-only tap target / locale regression against an explicitly local Next app.
// Never navigate to production, Vercel or a remote URL.
import { chromium } from "./playwright-qa.mjs";
import fs from "node:fs";

const base = process.env.KOL_LOCAL_VISUAL_QA_URL ?? "http://127.0.0.1:3100";
const parsed = new URL(base);
if (!["localhost","127.0.0.1","[::1]"].includes(parsed.hostname) || parsed.protocol !== "http:") {
  throw new Error("KÖL visual QA refuses non-local origins");
}
const routes = ["/", "/checkout", "/booking/checkout", "/admin", "/owner", "/partner", "/courier"];
const widths = [320, 375, 390, 430, 1440];
const locales = ["ru", "ky", "en"];
const browser = await chromium.launch({ headless: true });
const failures = [];
const results = [];
try {
  for (const width of widths) {
    for (const locale of locales) {
      const context = await browser.newContext({ viewport: { width, height: 844 } });
      await context.addInitScript(language => localStorage.setItem("kol-locale", language), locale);
      for (const route of routes) {
        const page = await context.newPage();
        try {
          const response = await page.goto(base + route, { waitUntil: "domcontentloaded", timeout: 30000 });
          if (!response || response.status() !== 200) {
            throw new Error("HTTP " + (response?.status() ?? "missing"));
          }
          await page.waitForFunction(lang => document.documentElement.lang === lang, locale, { timeout: 12000 });
          const data = await page.evaluate(() => {
            const visible = (el) => {
              const style = getComputedStyle(el);
              const r = el.getBoundingClientRect();
              return style.visibility !== "hidden" && style.display !== "none" &&
                r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 &&
                r.top < innerHeight && r.left < innerWidth && !el.closest("[aria-hidden=true]");
            };
            const small = [];
            for (const el of document.querySelectorAll(
              "button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=tab]"
            )) {
              if (el.matches(":disabled") || !visible(el)) continue;
              const box = el.getBoundingClientRect();
              if (box.width < 43.5 || box.height < 43.5) {
                small.push({
                  tag: el.tagName.toLowerCase(),
                  label: (el.getAttribute("aria-label") || el.textContent || el.getAttribute("name") || "")
                    .trim().slice(0, 70),
                  w: Math.round(box.width), h: Math.round(box.height)
                });
              }
            }
            return {
              lang: document.documentElement.lang,
              overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
              small: small.slice(0, 30),
              smallCount: small.length
            };
          });
          results.push({ route, width, locale, ...data });
          if (data.overflow > 2) failures.push({ route, width, locale, issue: "horizontal overflow", pixels: data.overflow });
          if (width <= 430 && data.smallCount) failures.push({ route, width, locale, issue: "sub-44px targets", targets: data.small });
        } catch (error) {
          failures.push({ route, width, locale, issue: String(error) });
        } finally { await page.close(); }
      }
      await context.close();
    }
  }
} finally { await browser.close(); }
fs.mkdirSync("visual-artifacts", { recursive: true });
fs.writeFileSync("visual-artifacts/tap-targets-locales.json",
  JSON.stringify({ status: failures.length ? "FAIL" : "PASS", results, failures }, null, 2) + "\n");
console.log("KÖL local responsive QA: " + (failures.length ? "FAIL " + failures.length : "PASS"));
if (failures.length) {
  console.error(JSON.stringify(failures.slice(0, 20), null, 2));
  process.exitCode = 1;
}
