import fs from "node:fs";

const settings = fs.readFileSync("src/app/admin/settings/page.tsx", "utf8");
const shell = fs.readFileSync("src/components/layout/AdminLayout.tsx", "utf8");
const runtime = fs.readFileSync("src/components/i18n/LanguageRuntime.tsx", "utf8");
const translations = fs.readFileSync("src/components/i18n/translations-admin-reviewed.ts", "utf8");

function fail(message) {
  console.error("KÖL admin translation QA: " + message);
  process.exitCode = 1;
}

function parseReviewed(locale) {
  const match = translations.match(new RegExp(
    "export const ADMIN_EXACT_" + locale + ": Record<string, string> = (\\{[\\s\\S]*?\\});"
  ));
  if (!match) throw new Error("Missing reviewed " + locale + " dictionary");
  return JSON.parse(match[1]);
}

const english = parseReviewed("EN");
const kyrgyz = parseReviewed("KY");
function allInterfaceSources(root) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const file = root + "/" + entry.name;
    if (entry.isDirectory()) return entry.name === "i18n" || entry.name === "__tests__" ? [] : allInterfaceSources(file);
    return (file.endsWith(".tsx") || (root.startsWith("src/data") && file.endsWith(".ts"))) ? [fs.readFileSync(file, "utf8")] : [];
  });
}
// Review keys against the entire interface, not just the initial admin screens.
// Keep dictionaries out of the source inventory so orphaned keys still fail.
const source = [settings, shell, ...allInterfaceSources("src/app"), ...allInterfaceSources("src/components"), ...allInterfaceSources("src/data"), fs.readFileSync("src/lib/data/client-loyalty-read.ts", "utf8"), fs.readFileSync("src/lib/i18n/status-labels.ts", "utf8")].join("\n");
// JSX line breaks are rendered as whitespace; normalize whitespace when checking that
// a reviewed source phrase still exists, without relaxing the orphan-key gate.
const normalizedSource = source.replace(/\s+/g, " ");
const enKeys = Object.keys(english);
const kyKeys = Object.keys(kyrgyz);

if (JSON.stringify(enKeys) !== JSON.stringify(kyKeys)) fail("RU source keys differ between EN and KY dictionaries.");
if (enKeys.length < 145) fail("The core admin shell/settings translation set is incomplete.");
for (const ru of enKeys) {
  const en = english[ru], ky = kyrgyz[ru];
  if (!normalizedSource.includes(ru.replace(/\s+/g, " "))) fail("Orphaned RU source string: " + ru);
  if (!en || !ky || !en.trim() || !ky.trim()) fail("Missing localized value for: " + ru);
  if (/[А-Яа-яЁё]/u.test(en)) fail("English copy contains Cyrillic: " + ru);
  if (en === ru && /[А-Яа-яЁё]/u.test(ru)) fail("English copy not translated: " + ru);
}
// Every demonstration catalogue description must have complete editorial translations.
// Do not force translation of business trademarks, IDs, URLs or technical codes.
const demonstrationCataloguePaths = [
  "src/data/mockStays.ts", "src/data/mockTours.ts", "src/data/mockFood.ts",
  "src/data/mockProducts.ts", "src/data/mockPartners.ts"
];
for (const file of demonstrationCataloguePaths) {
  const content = fs.readFileSync(file, "utf8");
  for (const [, description] of content.matchAll(/^\s*description:\s*"([^"]+)"/gm)) {
    if (!/[А-Яа-яЁё]/u.test(description)) continue;
    if (english[description] === undefined || kyrgyz[description] === undefined) {
      fail("Untranslated mock catalogue description in " + file + ": " + description);
    }
  }
}

for (const marker of ["Settings locked", "Browser UI", "Safety invariants", "Typed allowlist", "UI-only Save", "settings backend", "env values"]) {
  if (source.includes(marker)) fail("Untranslated technical English is visible in RU: " + marker);
}

const clientScreens = [
  "src/app/client/favorites/page.tsx",
  "src/app/client/loyalty/page.tsx",
  "src/app/client/offers/page.tsx",
  "src/app/admin/ai-dispatcher/AdminAiDispatcherDemoActions.tsx"
].map((page) => fs.readFileSync(page, "utf8")).join("\n");
for (const marker of [
  "mock data", "После auth", "loyalty account", "demo-транзакций",
  "offers locked", "Promotion records", "Eligibility rules", "discount amount",
  "high-risk", "human approval", "audit log"
]) {
  if (clientScreens.toLowerCase().includes(marker.toLowerCase())) {
    fail("Mixed-language copy remains in reviewed client/AI screens: " + marker);
  }
}

if (settings.includes("KOL_PRODUCTION_RUNTIME_READY must remain false")) {
  fail("Settings display a stale false runtime flag during an approved cloud canary.");
}
if (!runtime.includes("if (locale === \"en\" && ADMIN_EXACT_EN[value] !== undefined)") ||
    !runtime.includes("if (locale === \"ky\" && ADMIN_EXACT_KY[value] !== undefined)")) {
  fail("Exact locale translation no longer precedes legacy fragment maps.");
}
// Display labels must not expose raw database status codes in ADMIN.
const rankScreen = fs.readFileSync("src/app/admin/ranking/page.tsx", "utf8");
const courierDirectory = fs.readFileSync("src/app/admin/couriers/page.tsx", "utf8");
if (rankScreen.includes("{x.payment_status}</span>") ||
    !rankScreen.includes("displayPaymentStatus(x.payment_status)")) {
  fail("ADMIN promotions must display localized payment statuses.");
}
if (courierDirectory.includes('courier.availabilityStatus ?? "unknown"') ||
    !courierDirectory.includes("displayBusinessStatus(courier.availabilityStatus)")) {
  fail("ADMIN courier directory must display localized availability statuses.");
}

const roomCatalogue = fs.readFileSync("src/app/admin/catalog/rooms/page.tsx", "utf8");
if (roomCatalogue.includes("{room.status}</strong>") ||
    !roomCatalogue.includes("displayBusinessStatus(room.status)")) {
  fail("ADMIN room catalogue must display localized lifecycle status.");
}

if (!process.exitCode) console.log("KÖL admin RU/EN/KG reviewed translation source QA: PASS (" + enKeys.length + " phrases).");
