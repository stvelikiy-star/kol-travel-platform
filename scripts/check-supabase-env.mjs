import fs from "node:fs";
import path from "node:path";

const envPath = path.join(process.cwd(), ".env.local");

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return null;

  const content = fs.readFileSync(filePath, "utf8");
  const env = {};

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    env[key] = value;
  }

  return env;
}

function isPresent(value) {
  return typeof value === "string" && value.length > 0;
}

function printPresence(label, value) {
  console.log(`${label}: ${isPresent(value) ? "present" : "missing"}`);
}

const env = parseEnvFile(envPath);

if (!env) {
  console.log(".env.local: missing");
  console.log("Copy .env.example to .env.local when local Supabase configuration is needed.");
  process.exit(0);
}

console.log(".env.local: present");
printPresence("NEXT_PUBLIC_SUPABASE_URL", env.NEXT_PUBLIC_SUPABASE_URL);
printPresence(
  "Supabase public key",
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY
);
printPresence("SUPABASE_SERVICE_ROLE_KEY", env.SUPABASE_SERVICE_ROLE_KEY);

const dataSourceMode = env.DATA_SOURCE_MODE || "missing";
const alcoholModuleEnabled = env.ALCOHOL_MODULE_ENABLED || "missing";

console.log(`DATA_SOURCE_MODE: ${dataSourceMode}`);
console.log(`ALCOHOL_MODULE_ENABLED: ${alcoholModuleEnabled}`);

if (!['mock', 'supabase'].includes(dataSourceMode)) {
  console.warn("Warning: DATA_SOURCE_MODE must be mock or supabase.");
}

if (alcoholModuleEnabled !== "false") {
  console.warn("Warning: ALCOHOL_MODULE_ENABLED must remain false until explicit approval.");
}

console.log("No network connection attempted. No environment values or secrets printed.");
