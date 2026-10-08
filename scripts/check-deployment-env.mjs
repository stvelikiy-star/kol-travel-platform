function present(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function detectEnvironment() {
  // VERCEL_ENV is platform-provided and must win for real production. A manual
  // KOL_DEPLOYMENT_ENV override cannot downgrade production safety checks.
  if (process.env.VERCEL_ENV === "production") return "production";
  if (process.env.KOL_DEPLOYMENT_ENV) return process.env.KOL_DEPLOYMENT_ENV;
  if (process.env.VERCEL_ENV) return process.env.VERCEL_ENV;
  return "development";
}

// Keep this synchronized with src/lib/deployment-safety.ts. It must be changed
// to true only by a reviewed source commit after the full production audit.
const productionRuntimeImplementationReady = false;
const environment = detectEnvironment();
const dataSourceMode = process.env.DATA_SOURCE_MODE || "mock";
const alcoholEnabled = process.env.ALCOHOL_MODULE_ENABLED === "true";
const productionRuntimeRequested = process.env.KOL_PRODUCTION_RUNTIME_READY === "true";
const productionRuntimeReady = productionRuntimeImplementationReady && productionRuntimeRequested;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const publicKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.SUPABASE_ANON_KEY;

const isProduction = environment === "production";
const isSupabase = dataSourceMode === "supabase";
const errors = [];
const warnings = [];

for (const key of Object.keys(process.env)) {
  if (key.startsWith("NEXT_PUBLIC_") && /SERVICE.*ROLE|SECRET|PRIVATE/i.test(key)) {
    errors.push(`Unsafe public secret-like environment key: ${key}`);
  }
}

if (!["mock", "supabase"].includes(dataSourceMode)) {
  errors.push("DATA_SOURCE_MODE must be mock or supabase.");
}

if (alcoholEnabled) {
  errors.push("ALCOHOL_MODULE_ENABLED must remain false until legal/product approval.");
}

if (isSupabase && (!present(supabaseUrl) || !present(publicKey))) {
  errors.push("Supabase mode requires NEXT_PUBLIC_SUPABASE_URL and a publishable/anon public key.");
}

if (isProduction && !isSupabase) {
  errors.push("Production must use DATA_SOURCE_MODE=supabase; mock production is forbidden.");
}

if (isProduction && !productionRuntimeReady) {
  errors.push("Production is blocked until source implementation readiness and KOL_PRODUCTION_RUNTIME_READY=true are both approved after the release audit.");
}

if (!isProduction && dataSourceMode === "mock") {
  warnings.push("Preview/development is running intentionally in mock mode.");
}

if (!isProduction && isSupabase) {
  warnings.push("Preview/development is connected to Supabase; confirm it is a dedicated staging project, not production.");
}

if (!isProduction && productionRuntimeRequested) {
  warnings.push("KOL_PRODUCTION_RUNTIME_READY is ignored outside production and does not override source readiness.");
}

console.log(`KÖL deployment environment: ${environment}`);
console.log(`DATA_SOURCE_MODE: ${dataSourceMode}`);
console.log(`Supabase public config: ${present(supabaseUrl) && present(publicKey) ? "present" : "missing"}`);
console.log(`Production implementation gate: ${productionRuntimeImplementationReady ? "approved" : "blocked"}`);
console.log(`Production runtime gate: ${productionRuntimeReady ? "enabled" : "blocked"}`);
console.log(`Alcohol module: ${alcoholEnabled ? "UNSAFE_ENABLED" : "disabled"}`);
console.log(`Service-role secret: ${present(process.env.SUPABASE_SERVICE_ROLE_KEY) ? "present server-side" : "not present"}`);

for (const warning of warnings) console.warn(`WARN: ${warning}`);
for (const error of errors) console.error(`ERROR: ${error}`);

if (errors.length > 0) {
  process.exitCode = 1;
} else {
  console.log("Deployment environment preflight: PASS");
}

console.log("No secret values were printed.");
