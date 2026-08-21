import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const evidencePath = path.join(
  root,
  "docs/sql/KOL_LIVE_BASELINE_CAPTURE_READONLY_2026-08-21.sql"
);

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(evidencePath)) {
  fail("live baseline evidence SQL is missing");
}

const source = fs.readFileSync(evidencePath, "utf8");

// Remove comments and string/identifier literals before keyword inspection so the
// safety contract can mention forbidden words without triggering false positives.
const code = source
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/--[^\n\r]*/g, " ")
  .replace(/'(?:''|[^'])*'/g, "''")
  .replace(/"(?:""|[^"])*"/g, '""');

const normalized = code.replace(/\s+/g, " ").trim();

if (!/\bBEGIN\s*;/i.test(normalized)) {
  fail("evidence SQL must open an explicit transaction with BEGIN");
}
if (!/\bSET\s+TRANSACTION\s+READ\s+ONLY\s*;/i.test(normalized)) {
  fail("evidence SQL must set the transaction READ ONLY");
}
if (!/\bCOMMIT\s*;?\s*$/i.test(normalized)) {
  fail("evidence SQL must finish with COMMIT");
}

const forbiddenKeywords = [
  "INSERT",
  "UPDATE",
  "DELETE",
  "MERGE",
  "TRUNCATE",
  "CREATE",
  "ALTER",
  "DROP",
  "GRANT",
  "REVOKE",
  "CALL",
  "DO",
  "COPY",
  "VACUUM",
  "ANALYZE",
  "REFRESH",
  "REINDEX",
  "CLUSTER"
];

for (const keyword of forbiddenKeywords) {
  const pattern = new RegExp(`\\b${keyword}\\b`, "i");
  if (pattern.test(code)) {
    fail(`forbidden mutating/administrative SQL keyword detected: ${keyword}`);
  }
}

// A SELECT of a project RPC could still mutate state even inside ordinary SQL.
// The evidence pack may read public tables but must not execute public functions.
if (/\bpublic\s*\.\s*[a-zA-Z_][a-zA-Z0-9_]*\s*\(/.test(code)) {
  fail("project public function/RPC invocation detected in read-only evidence SQL");
}

const statements = code
  .split(";")
  .map((statement) => statement.trim())
  .filter(Boolean);

const allowedStarters = /^(BEGIN\b|SET\s+TRANSACTION\s+READ\s+ONLY\b|SELECT\b|WITH\b|COMMIT\b)/i;
for (const statement of statements) {
  if (!allowedStarters.test(statement)) {
    fail(`unexpected statement class in read-only evidence SQL: ${statement.slice(0, 80)}`);
  }
}

console.log("KÖL live baseline evidence read-only contract: PASS");
console.log("No SQL executed. No network connection attempted.");
