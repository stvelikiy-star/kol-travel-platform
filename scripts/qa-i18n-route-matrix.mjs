// Browser localization matrix for all static pages on both screen sizes.
// Runs against isolated mock Preview; never signs in to Production or modifies data.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "./playwright-qa.mjs";

const root = "src/app";
const base = process.env.KOL_QA_SITE_URL || "http://127.0.0.1:3100";
const brandOrTechnical = /^(?:KÖL|WhatsApp|Telegram|Supabase|PostgreSQL|Vercel|OpenAI|KGS|USD|RU|KG|EN|AI|ИИ|ID|API|RPC|RLS|URL|JWT)(?:\s*[.·-]\s*(?:KÖL|AI|ИИ))?$/iu;
// Exactly known proper names from the bundled demo/catalogue references.
// Never blanket-ignore arbitrary catalogue text: a real untranslated UI phrase
// must remain visible as an audit finding, including captions and alt suffixes.
const recognizedProperNames = new Set([
  "Ак-Бермет Spa & Wellness",
  "Три Короны Resort & SPA",
  "Три Короны Resort & SPA, Чолпон-Ата",
  "Aurora Lake Hotel",
  "Tamchy Breakfast",
  "Karakol Adventure"
]);
function isProperName(value) {
  return recognizedProperNames.has(value.trim());
}


function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return entry.name.startsWith("_") ? [] : walk(entryPath);
    return entry.name === "page.tsx" ? [entryPath] : [];
  });
}
function toRoute(file) {
  const parts = path.relative(root, path.dirname(file)).split(path.sep)
    .filter((part) => part && !/^\(.*\)$/.test(part));
  if (parts.some((part) => part.startsWith("[") || part.startsWith("@"))) return null;
  return "/" + parts.join("/");
}
const staticRoutes = [...new Set(walk(root).map(toRoute).filter(Boolean))].sort();
// Include all thirteen dynamic page families, with mock-only identifiers.
// Some scoped pages may redirect without QA credentials; never impersonate a user.
const dynamicSamples = [
  "/stays/guest-house-bosteri-ui", "/tours/boat-trip-cholpon-ata",
  "/food/naryn-beshbarmak", "/shop/sary-oi-market",
  "/client/bookings/booking-stay-pending", "/client/orders/order-food-new",
  "/courier/deliveries/order-food-new", "/partner/bookings/booking-stay-pending",
  "/partner/orders/order-food-new", "/partner/catalog/food/food-001",
  "/partner/catalog/products/product-001",
  "/partner/catalog/stays/stay-ak-bermet",
  "/partner/catalog/tours/tour-boat-cholpon-ata"
];
const routes = [...new Set([...staticRoutes, ...dynamicSamples])];
const browser = await chromium.launch({ headless: true });
const viewports = [
  ["desktop", { width: 1440, height: 900 }],
  ["mobile", { width: 390, height: 844 }]
];
const issues = [];
const routeResults = [];
const allLocales = ["ru", "en", "ky"];
// Enforce every reviewed translation against the real rendered DOM, while
// retaining proper nouns and unreviewed content as separately reported findings.
const reviewedSource = fs.readFileSync("src/components/i18n/translations-admin-reviewed.ts", "utf8");
function reviewedDictionary(locale) {
  const match = reviewedSource.match(new RegExp(
    "export const ADMIN_EXACT_" + locale + ": Record<string, string> = (\\{[\\s\\S]*?\\});"
  ));
  if (!match) throw new Error("Reviewed " + locale + " dictionary unavailable");
  return JSON.parse(match[1]);
}
const reviewedEN = reviewedDictionary("EN");
const reviewedKY = reviewedDictionary("KY");

function collectVisibleText() {
  const values = [];
  const iterator = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = iterator.nextNode())) {
    const parent = node.parentElement;
    if (!parent || parent.closest('[translate="no"],[data-i18n-ignore="true"],[aria-hidden="true"]')) continue;
    if (["SCRIPT","STYLE","NOSCRIPT","PRE","CODE","TEXTAREA"].includes(parent.tagName)) continue;
    if (!parent.getClientRects().length) continue;
    const value = (node.nodeValue || "").replace(/\s+/g, " ").trim();
    if (value.length >= 4 && value.length < 400) values.push(value);
  }
  document.querySelectorAll("[placeholder],[aria-label],[aria-description],[title],[alt],input[type=submit][value]").forEach((element) => {
    if (!element.getClientRects().length || element.closest('[translate="no"],[data-i18n-ignore="true"]')) return;
    for (const attribute of ["placeholder","aria-label","aria-description","title","alt"]) {
      const value = element.getAttribute(attribute)?.trim();
      if (value && value.length >= 4 && value.length < 400) values.push(value);
    }
    if (element.matches("input[type=submit],input[type=button],input[type=reset]")) {
      const value = element.getAttribute("value")?.trim();
      if (value) values.push(value);
    }
  });
  return [...new Set(values)];
}

function untranslatedExact(source, target) {
  const targetSet = new Set(target);
  return source.filter((item) => item.length >= 22 &&
    /[А-Яа-яЁё]/u.test(item) && !brandOrTechnical.test(item) &&
    !isProperName(item) && targetSet.has(item)).slice(0, 24);
}
function untranslatedReviewed(source, target, dictionary) {
  const visible = new Set(target);
  // Unlike heuristic reporting, this gate includes even short exact labels.
  // Same-spelling legitimate translations (for example Каталог) are exempt.
  return source.filter((value) => dictionary[value] !== undefined &&
    dictionary[value] !== value && visible.has(value)).slice(0, 48);
}
function untranslatedEnglish(source) {
  return source.filter((item) => item.length > 3 &&
    /[A-Za-z]{4}/.test(item) && !/[А-Яа-яЁёүөңҮӨҢ]/u.test(item) &&
    !brandOrTechnical.test(item) && !isProperName(item) &&
    /[A-Za-z]{3,}\s+[A-Za-z]{3,}/.test(item) &&
    !/https?:\/\/|\S+@\S+|\b(?:KÖL|WhatsApp|Telegram|Supabase|PostgreSQL|Vercel)\b/i.test(item)).slice(0, 16);
}

try {
  for (const [device, viewport] of viewports) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    page.setDefaultTimeout(9000);
    for (const route of routes) {
      const result = { device, route, status: null, routeAfterRedirect: "", locales: {}, errors: [] };
      try {
        const response = await page.goto(base + route, { waitUntil: "domcontentloaded", timeout: 26000 });
        result.status = response?.status() ?? null;
        result.routeAfterRedirect = new URL(page.url()).pathname;
        await page.waitForFunction(() => document.documentElement.dataset.kolLocale, null, { timeout: 12000 });
        for (const locale of allLocales) {
          const option = page.locator('[data-language-option="' + locale + '"]:visible').first();
          if (!(await option.count())) throw new Error("Language switcher missing: " + locale);
          if ((await page.locator("html").getAttribute("lang")) !== locale) await option.click();
          await page.waitForFunction((expected) => document.documentElement.lang === expected, locale, { timeout: 7000 });
          await page.waitForTimeout(85);
          const content = await page.evaluate(collectVisibleText);
          result.locales[locale] = content;
        }
        const ru = result.locales.ru, en = result.locales.en, ky = result.locales.ky;
        const sameEnglish = untranslatedExact(ru, en);
        const sameKyrgyz = untranslatedExact(ru, ky);
        const englishInRu = untranslatedEnglish(ru);
        const reviewedEnglish = untranslatedReviewed(ru, en, reviewedEN);
        const reviewedKyrgyz = untranslatedReviewed(ru, ky, reviewedKY);
        if (sameEnglish.length || sameKyrgyz.length || englishInRu.length ||
            reviewedEnglish.length || reviewedKyrgyz.length) {
          issues.push({ device, route, sameEnglish, sameKyrgyz, englishInRu,
            reviewedEnglish, reviewedKyrgyz });
        }
      } catch (error) {
        result.errors.push(String(error).slice(0, 260));
        issues.push({ device, route, fatal: result.errors[0] });
      }
      // Avoid writing raw client/account data into a CI artifact.
      routeResults.push({
        device, route, status: result.status,
        actualRoute: result.routeAfterRedirect, errors: result.errors,
        labels: Object.fromEntries(Object.entries(result.locales).map(([k,v]) => [k,v.length]))
      });
    }
    await page.close();
    await context.close();
  }
} finally {
  await browser.close();
}
const summary = {
  routes: routes.length, staticRoutes: staticRoutes.length,
  viewports: viewports.map(([name]) => name), locales: allLocales,
  checked: routeResults.length, flagged: issues.length,
  fatal: issues.filter((x) => x.fatal).length,
  reviewedFailures: issues.reduce((count, issue) => count +
    (issue.reviewedEnglish?.length ?? 0) + (issue.reviewedKyrgyz?.length ?? 0), 0)
};
fs.mkdirSync("visual-artifacts", { recursive: true });
fs.writeFileSync("visual-artifacts/kol-i18n-route-matrix.json", JSON.stringify({ summary, routes: routeResults, issues }, null, 2));
console.log("KÖL second-pass browser locale matrix: " + JSON.stringify(summary));
console.log(JSON.stringify(issues.slice(0, 15), null, 2));
if (summary.fatal) {
  console.error("KÖL locale matrix has fatal navigation or switcher errors.");
  process.exitCode = 1;
}
if (summary.reviewedFailures > 0) {
  const required = issues.map((issue) => ({
    device: issue.device,
    route: issue.route,
    untranslatedEN: issue.reviewedEnglish ?? [],
    untranslatedKY: issue.reviewedKyrgyz ?? []
  })).filter((issue) => issue.untranslatedEN.length || issue.untranslatedKY.length);
  console.error("Reviewed UI translations still visible in the wrong language:", JSON.stringify(required.slice(0, 20), null, 2));
  process.exitCode = 1;
}
// Proper names, user-entered catalogue content and unreviewed copy remain findings.
// A green matrix means no *reviewed* phrase is untranslated; it does not claim
// every arbitrary new catalogue record has a verified editorial translation.
