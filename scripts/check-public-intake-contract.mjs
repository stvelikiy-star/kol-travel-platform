import fs from "node:fs";
import assert from "node:assert/strict";
import ts from "typescript";

const source = fs.readFileSync("src/lib/intake/intake-security.ts", "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }}).outputText;
const helpers = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
const oldKey = process.env.KOL_PUBLIC_INTAKE_HMAC_KEY;
const oldHeader = process.env.KOL_INTAKE_TRUSTED_IP_HEADER;
try {
  delete process.env.KOL_PUBLIC_INTAKE_HMAC_KEY;
  assert.throws(() => helpers.intakeSecret(), /not_configured/);
  process.env.KOL_PUBLIC_INTAKE_HMAC_KEY = "local-qa-only-key-do-not-use-in-any-real-environment-1234";
  process.env.KOL_INTAKE_TRUSTED_IP_HEADER = "cf-connecting-ip";
  const secret = helpers.intakeSecret();
  const now = 2_000_000_000_000;
  const tooFast = helpers.createIntakeFormProof(secret,now-100);
  const valid = helpers.createIntakeFormProof(secret,now-3000);
  const stale = helpers.createIntakeFormProof(secret,now-14_500_000);
  assert.equal(helpers.validIntakeFormProof(tooFast,secret,now),false);
  assert.equal(helpers.validIntakeFormProof(valid,secret,now),true);
  assert.equal(helpers.validIntakeFormProof(stale,secret,now),false);
  assert.equal(helpers.validIntakeFormProof(valid.slice(0,-1) + (valid.endsWith("0") ? "1" : "0"),secret,now),false);
  assert.equal(helpers.validIntakeFormProof("not-a-proof",secret,now),false);
  assert.equal(helpers.trustedIntakeIp(new Headers({"cf-connecting-ip":"203.0.113.10"})),"203.0.113.10");
  assert.throws(()=>helpers.trustedIntakeIp(new Headers({"cf-connecting-ip":"203.0.113.10, 10.0.0.1"})));
  assert.throws(()=>helpers.trustedIntakeIp(new Headers({"x-forwarded-for":"203.0.113.10"})));
  assert.notEqual(helpers.intakeDigest("ip","203.0.113.10",secret),helpers.intakeDigest("phone","203.0.113.10",secret));
  assert.equal(helpers.intakeDigest("ip","203.0.113.10",secret).length,64);
  process.env.KOL_INTAKE_TRUSTED_IP_HEADER = "x-forwarded-for";
  assert.throws(()=>helpers.trustedIntakeIp(new Headers({"x-forwarded-for":"203.0.113.10"})));
  const action = fs.readFileSync("src/app/actions/public/intake.ts","utf8");
  assert.match(action,/validIntakeFormProof/);
  assert.match(action,/trustedIntakeIp/);
  assert.match(action,/\.rpc\("public_intake_create_atomic"/);
  assert.doesNotMatch(action,/\.from\("support_tickets"\)/);
  assert.match(action,/uuidV4\.test\(input\.requestId\)/);
  for(const file of ["src/app/checkout/page.tsx","src/app/booking/checkout/page.tsx","src/app/partners/page.tsx"]){
    const ui=fs.readFileSync(file,"utf8");
    assert.match(ui,/name="website"/);
    assert.match(ui,/honeypot:\s*website/);
  }
  console.log("PUBLIC_INTAKE_CONTRACT_PASS: signed timing, trusted single IP, no bypass insert, 3 honeypots");
} finally {
  if(oldKey===undefined)delete process.env.KOL_PUBLIC_INTAKE_HMAC_KEY;
  else process.env.KOL_PUBLIC_INTAKE_HMAC_KEY=oldKey;
  if(oldHeader===undefined)delete process.env.KOL_INTAKE_TRUSTED_IP_HEADER;
  else process.env.KOL_INTAKE_TRUSTED_IP_HEADER=oldHeader;
}
