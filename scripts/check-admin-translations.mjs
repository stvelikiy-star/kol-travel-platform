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
const source = settings + "\n" + shell;
const enKeys = Object.keys(english);
const kyKeys = Object.keys(kyrgyz);

if (JSON.stringify(enKeys) !== JSON.stringify(kyKeys)) fail("RU source keys differ between EN and KY dictionaries.");
if (enKeys.length < 55) fail("The core admin shell/settings translation set is incomplete.");
for (const ru of enKeys) {
  const en = english[ru], ky = kyrgyz[ru];
  if (!source.includes(ru)) fail("Orphaned RU source string: " + ru);
  if (!en || !ky || !en.trim() || !ky.trim()) fail("Missing localized value for: " + ru);
  if (/[А-Яа-яЁё]/u.test(en)) fail("English copy contains Cyrillic: " + ru);
  if (en === ru && /[А-Яа-яЁё]/u.test(ru)) fail("English copy not translated: " + ru);
}
for (const marker of ["Settings locked", "Browser UI", "Safety invariants", "Typed allowlist", "UI-only Save", "settings backend", "env values"]) {
  if (source.includes(marker)) fail("Untranslated technical English is visible in RU: " + marker);
}
if (settings.includes("KOL_PRODUCTION_RUNTIME_READY must remain false")) {
  fail("Settings display a stale false runtime flag during an approved cloud canary.");
}
if (!runtime.includes("if (locale === \"en\" && ADMIN_EXACT_EN[value] !== undefined)") ||
    !runtime.includes("if (locale === \"ky\" && ADMIN_EXACT_KY[value] !== undefined)")) {
  fail("Exact locale translation no longer precedes legacy fragment maps.");
}
if (!process.exitCode) console.log("KÖL admin RU/EN/KG reviewed translation source QA: PASS (" + enKeys.length + " phrases).");
