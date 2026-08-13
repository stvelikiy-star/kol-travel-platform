import fs from "node:fs";
import path from "node:path";

const envPath = path.join(process.cwd(), ".env.local");

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, "utf8");
  const env = {};

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

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
  console.log("This is acceptable before manual Supabase setup. Copy .env.local.template to .env.local when ready.");
  process.exit(0);
}

console.log(".env.local: present");
printPresence("NEXT_PUBLIC_SUPABASE_URL", env.NEXT_PUBLIC_SUPABASE_URL);

if (isPresent(env.NEXT_PUBLIC_SUPABASE_URL)) {
  console.log(`NEXT_PUBLIC_SUPABASE_URL preview: ${env.NEXT_PUBLIC_SUPABASE_URL.slice(0, 8)}...`);
}

printPresence("NEXT_PUBLIC_SUPABASE_ANON_KEY", env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
printPresence("SUPABASE_SERVICE_ROLE_KEY", env.SUPABASE_SERVICE_ROLE_KEY);

const dataSourceMode = env.DATA_SOURCE_MODE || "missing";
const alcoholModuleEnabled = env.ALCOHOL_MODULE_ENABLED || "missing";

console.log(`DATA_SOURCE_MODE: ${dataSourceMode}`);
console.log(`ALCOHOL_MODULE_ENABLED: ${alcoholModuleEnabled}`);

if (dataSourceMode !== "mock") {
  console.warn("Warning: DATA_SOURCE_MODE is not mock. Keep mock until schema, RLS and seed data are verified.");
}

if (alcoholModuleEnabled !== "false") {
  console.warn("Warning: ALCOHOL_MODULE_ENABLED is not false. Alcohol module must remain disabled by default.");
}

console.log("No Supabase connection attempted. No secrets printed.");
