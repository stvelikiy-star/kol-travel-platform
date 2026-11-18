import fs from "node:fs";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
const safety = fs.readFileSync("src/lib/deployment-safety.ts", "utf8");
const proxy = fs.readFileSync("src/proxy.ts","utf8");
assert.match(safety, /production && dataSourceMode !== "supabase"/);
assert.match(safety, /production_requires_supabase/);
assert.match(safety, /PRODUCTION_RUNTIME_IMPLEMENTATION_READY = false/);
assert.match(proxy, /createBlockedResponse/);
assert.match(proxy, /status: 503/);
assert.match(proxy, /if \(!safety\.safe\)/);
const envs = [
  { KOL_DEPLOYMENT_ENV: "production", VERCEL_ENV: "" },
  { KOL_DEPLOYMENT_ENV: "development", VERCEL_ENV: "production" }
];
for (const extra of envs) {
  const result = spawnSync(process.execPath,["scripts/check-deployment-env.mjs"],{
    encoding:"utf8",
    env:{ ...process.env, ...extra, DATA_SOURCE_MODE:"mock", KOL_DEMO_ACCESS:"false",
      KOL_PRODUCTION_RUNTIME_READY:"false", ALCOHOL_MODULE_ENABLED:"false" }
  });
  assert.equal(result.status,1,`production mock MUST fail preflight: ${JSON.stringify(extra)}`);
}
console.log("PRODUCTION_MOCK_SOURCE_GUARD_PASS (HTTP regression runs after build)");
