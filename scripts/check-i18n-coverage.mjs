import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourceRoots = ["src/app", "src/components"];
const i18nDir = path.join(root, "src/components/i18n");

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function pairs(text) {
  return [...text.matchAll(/^\s*"((?:[^"\\]|\\.)*)"\s*:\s*"((?:[^"\\]|\\.)*)"/gm)]
    .map((match) => [match[1], match[2]]);
}

const dictionaryFiles = walk(i18nDir).filter((file) => /translations.*\.ts$/.test(file));
const ky = new Set();
const kyValues = new Set();
const en = new Set();

for (const file of dictionaryFiles) {
  const base = path.basename(file);
  for (const [from, to] of pairs(read(file))) {
    if (/ky|presentation|final-audit|final-polish/.test(base) || base === "translations.ts") {
      if (/[А-Яа-яЁё]/.test(from)) ky.add(from);
      if (/[А-Яа-яЁё]/.test(to)) kyValues.add(to);
    }

    if (/-en/.test(base)) {
      if (/[А-Яа-яЁё]/.test(from)) en.add(from);
      if (/[А-Яа-яЁё]/.test(to)) en.add(to);
    }

    if (base === "translations.ts" && /^[A-Za-z]/.test(from) && /[А-Яа-яЁё]/.test(to)) {
      en.add(to);
    }
  }
}

const sourceFiles = sourceRoots
  .flatMap((dir) => walk(path.join(root, dir)))
  .filter((file) => /\.(ts|tsx)$/.test(file))
  .filter((file) => !file.includes(`${path.sep}i18n${path.sep}`))
  // API route responses are not rendered by the DOM translation runtime.
  .filter((file) => !file.includes(`${path.sep}api${path.sep}`));

const literals = new Map();

for (const file of sourceFiles) {
  const relative = path.relative(root, file);
  const text = read(file);

  for (const match of text.matchAll(/(["'])([^"'\n]*[А-Яа-яЁё][^"'\n]*)\1/g)) {
    const value = match[2].trim();
    if (!value || value.includes("\\") || value.length > 500) continue;
    // The simple literal scanner can capture JSX/template fragments around
    // real text. They are parser artefacts, not user-facing strings.
    if (/[<>]|className=|\$\{|=>/.test(value)) continue;
    if (!literals.has(value)) literals.set(value, new Set());
    literals.get(value).add(relative);
  }
}

const missingKy = [];
const missingEn = [];

for (const [value, files] of literals) {
  // Some presentation screens intentionally contain already translated
  // Kyrgyz copy. It is not a Russian source literal that needs another KY
  // mapping, so treat known KY dictionary values as covered as well.
  if (!ky.has(value) && !kyValues.has(value)) missingKy.push({ value, files: [...files] });
  if (!en.has(value)) missingEn.push({ value, files: [...files] });
}

function printMissing(label, items) {
  if (!items.length) {
    console.log(`${label}: PASS (0 missing)`);
    return;
  }
  console.error(`\n${label}: FAIL (${items.length} missing)\n`);
  for (const item of items.slice(0, 200)) {
    console.error(`- ${JSON.stringify(item.value)} :: ${item.files.join(", ")}`);
  }
  if (items.length > 200) console.error(`... and ${items.length - 200} more`);
}

console.log(`Scanned UI source files: ${sourceFiles.length}`);
console.log(`Unique Russian UI literals: ${literals.size}`);
console.log(`KY dictionary keys: ${ky.size}`);
console.log(`EN dictionary keys/values: ${en.size}`);

printMissing("Kyrgyz coverage", missingKy);
printMissing("English coverage", missingEn);

if (missingKy.length || missingEn.length) process.exit(1);
