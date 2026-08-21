import { spawnSync } from "node:child_process";

const script = new URL("./check-deployment-env.mjs", import.meta.url);

function runScenario(name, env, expectedStatus) {
  const result = spawnSync(process.execPath, [script.pathname], {
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
  "production_supabase_explicitly_ready_allowed",
  {
    ...base,
    KOL_DEPLOYMENT_ENV: "production",
    DATA_SOURCE_MODE: "supabase",
    KOL_PRODUCTION_RUNTIME_READY: "true",
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_ci_test"
  },
  0
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
