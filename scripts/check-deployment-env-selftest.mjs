import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("./check-deployment-env.mjs", import.meta.url));

function runScenario(name, env, expectedStatus) {
  const result = spawnSync(process.execPath, [script], {
    env,
    encoding: "utf8"
  });

  const actualStatus = result.status ?? 1;
  if (actualStatus !== expectedStatus) {
    console.error(`Scenario ${name}: expected exit ${expectedStatus}, got ${actualStatus}.`);
    console.error(result.stdout);
    console.error(result.stderr);
    process.exitCode = 1;
    return;
  }

  console.log(`Scenario ${name}: PASS (exit ${actualStatus}).`);
}

const base = {
  DATA_SOURCE_MODE: "mock",
  KOL_DEPLOYMENT_ENV: "development",
  KOL_PRODUCTION_RUNTIME_READY: "false",
  ALCOHOL_MODULE_ENABLED: "false"
};

runScenario("development_mock_allowed", { ...base }, 0);
runScenario(
  "production_mock_blocked",
  { ...base, KOL_DEPLOYMENT_ENV: "production" },
  1
);
runScenario(
  "vercel_production_cannot_be_downgraded_by_manual_override",
  { ...base, VERCEL_ENV: "production", KOL_DEPLOYMENT_ENV: "development" },
  1
);
runScenario(
  "vercel_production_preview_override_cannot_bypass_gate",
  { ...base, VERCEL_ENV: "production", KOL_DEPLOYMENT_ENV: "preview" },
  1
);
runScenario(
  "production_supabase_without_runtime_gate_blocked",
  {
    ...base,
    KOL_DEPLOYMENT_ENV: "production",
    DATA_SOURCE_MODE: "supabase",
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_ci_test"
  },
  1
);
runScenario(
  "production_missing_server_key_blocked",
  {
    ...base,
    KOL_DEPLOYMENT_ENV: "production",
    DATA_SOURCE_MODE: "supabase",
    KOL_PRODUCTION_RUNTIME_READY: "true",
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_ci_test"
  },
  1
);
runScenario(
  "cloud_canary_both_gates_with_server_key_allowed",
  {
    ...base,
    KOL_DEPLOYMENT_ENV: "production",
    DATA_SOURCE_MODE: "supabase",
    KOL_DEMO_ACCESS: "false",
    KOL_PRODUCTION_RUNTIME_READY: "true",
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_ci_test",
    SUPABASE_SERVICE_ROLE_KEY: "sb_secret_ci_test_only",
    KOL_INTAKE_IP_HMAC_KEY: "independent-ci-HMAC-only-2026-1234567890123456"
  },
  0
);
runScenario(
  "production_no_independent_hmac_blocked",
  {
    ...base, KOL_DEPLOYMENT_ENV: "production", DATA_SOURCE_MODE: "supabase",
    KOL_PRODUCTION_RUNTIME_READY: "true",
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_ci_test",
    SUPABASE_SERVICE_ROLE_KEY: "sb_secret_ci_test_only"
  },
  1
);
runScenario(
  "production_reused_hmac_key_blocked",
  {
    ...base, KOL_DEPLOYMENT_ENV: "production", DATA_SOURCE_MODE: "supabase",
    KOL_PRODUCTION_RUNTIME_READY: "true",
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_ci_test",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key-for-ci-test-only-1234567890",
    KOL_INTAKE_IP_HMAC_KEY: "service-role-key-for-ci-test-only-1234567890"
  },
  1
);
runScenario(
  "preview_weak_hmac_key_blocked",
  {
    ...base, KOL_DEPLOYMENT_ENV: "preview", DATA_SOURCE_MODE: "supabase",
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_ci_test",
    KOL_INTAKE_IP_HMAC_KEY: "short"
  },
  1
);
runScenario(
  "alcohol_enabled_blocked",
  { ...base, ALCOHOL_MODULE_ENABLED: "true" },
  1
);
runScenario(
  "public_service_role_key_blocked",
  { ...base, NEXT_PUBLIC_SERVICE_ROLE_KEY: "not-a-real-secret" },
  1
);

if (!process.exitCode) {
  console.log("Deployment environment self-test: PASS");
}
