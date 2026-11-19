// Regression: production and Vercel production must never serve mock workspaces.
// Runs a local Next server only; never connects to a remote database or Vercel.
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { setTimeout as sleep } from "node:timers/promises";

async function choosePort() {
  const server = createServer();
  await new Promise((resolve, reject) => server.once("error", reject).listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : null;
  await new Promise(resolve => server.close(resolve));
  if (!port) throw Error("Could not allocate a local TCP port");
  return port;
}

async function runScenario(name, environment) {
  const port = await choosePort();
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start",
    "--hostname", "127.0.0.1", "--port", String(port)], {
    env: {
      ...process.env,
      ...environment,
      DATA_SOURCE_MODE: "mock",
      KOL_PRODUCTION_RUNTIME_READY: "false",
      KOL_DEMO_ACCESS: "false",
      ALCOHOL_MODULE_ENABLED: "false",
      NEXT_TELEMETRY_DISABLED: "1"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  for (const stream of [child.stdout, child.stderr]) stream.on("data", chunk => {
    output = (output + String(chunk)).slice(-6000);
  });
  try {
    const base = "http://127.0.0.1:" + port;
    let ready = false;
    for (let i = 0; i < 60; i++) {
      if (child.exitCode !== null) break;
      try {
        const response = await fetch(base + "/api/health", { signal: AbortSignal.timeout(1000) });
        if (response.status === 503) { ready = true; break; }
      } catch { /* app still starting */ }
      await sleep(500);
    }
    if (!ready) throw new Error(name + ": no safe readiness response from local Next; " + output);
    for (const route of ["/admin", "/owner", "/partner", "/courier"]) {
      const response = await fetch(base + route, { redirect: "manual", signal: AbortSignal.timeout(4000) });
      const body = await response.text();
      const reportCsp = response.headers.get("content-security-policy-report-only");
      const hsts = response.headers.get("strict-transport-security");
      if (!reportCsp?.includes("default-src 'self'") || hsts) {
        throw new Error(name + " " + route + " violated CSP report-only or HTTPS-only HSTS");
      }
      if (response.status !== 503 || !body.includes("Service temporarily unavailable.")) {
        throw new Error(name + " " + route + " returned HTTP " + response.status + " instead of fail-closed 503");
      }
      console.log(name + " " + route + ": 503 PASS");
    }
  } finally {
    child.kill("SIGTERM");
    await Promise.race([
      new Promise(resolve => child.once("exit", resolve)),
      sleep(2000)
    ]);
    if (child.exitCode === null) child.kill("SIGKILL");
  }
}

await runScenario("kol_production_mock", { KOL_DEPLOYMENT_ENV: "production", VERCEL_ENV: "" });
await runScenario("vercel_production_mock", { KOL_DEPLOYMENT_ENV: "preview", VERCEL_ENV: "production" });
console.log("KÖL production mock route isolation: PASS");
