import { spawn } from "node:child_process";
import assert from "node:assert/strict";

const base = "http://127.0.0.1:3112";
const routes = ["/admin","/owner","/partner","/courier"];
async function scenario(label, marker) {
  const child = spawn(process.execPath,["node_modules/next/dist/bin/next","start","-H","127.0.0.1","-p","3112"],{
    env: { ...process.env, DATA_SOURCE_MODE:"mock", KOL_PRODUCTION_RUNTIME_READY:"false",
      ALCOHOL_MODULE_ENABLED:"false", KOL_DEMO_ACCESS:"false",
      KOL_DEPLOYMENT_ENV:marker === "vercel" ? "development" : "production",
      VERCEL_ENV:marker === "vercel" ? "production" : "" },
    stdio:["ignore","pipe","pipe"]
  });
  let logs = "";
  child.stdout.on("data", b => { logs += b.toString().slice(0,1000); });
  child.stderr.on("data", b => { logs += b.toString().slice(0,1000); });
  try {
    let up = false;
    for (let n=0;n<100;n++) {
      if (child.exitCode !== null) throw new Error(`Next exited early: ${logs}`);
      try { await fetch(base+"/api/health",{signal:AbortSignal.timeout(1000)}); up=true; break; }
      catch { await new Promise(r=>setTimeout(r,200)); }
    }
    assert.ok(up,`local Next server did not start: ${logs}`);
    for (const path of routes) {
      const response = await fetch(base+path,{redirect:"manual",signal:AbortSignal.timeout(5000)});
      const body = await response.text();
      assert.equal(response.status,503,`${label}: ${path} must fail closed`);
      assert.match(body,/Service temporarily unavailable/);
      assert.doesNotMatch(body,/demoOrder|mockOrders|Demo cabinet|Данные взяты из mock/i);
    }
    console.log(`PRODUCTION_MOCK_HTTP_PASS ${label} routes=${routes.length}`);
  } finally {
    child.kill("SIGTERM");
    await new Promise(resolve=>{if(child.exitCode !== null)resolve();else{child.once("exit",resolve);setTimeout(resolve,4000);}});
  }
}
await scenario("KOL_DEPLOYMENT_ENV=production","kol");
await scenario("VERCEL_ENV=production","vercel");
