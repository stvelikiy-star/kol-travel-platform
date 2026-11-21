import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

// Import and exercise the actual TypeScript utility without running a Next.js server
// or contacting any network, Auth endpoint or PostgreSQL instance.
const source = readFileSync("src/lib/intake/trusted-ip.ts", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText;
const { trustedIntakeIp } = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));

const ip4 = new Headers({ "x-forwarded-for": "203.0.113.10" });
const ip6 = new Headers({ "cf-connecting-ip": "2001:db8::1234" });
assert.equal(trustedIntakeIp(ip4, "x-forwarded-for"), "203.0.113.10");
assert.equal(trustedIntakeIp(ip6, "cf-connecting-ip"), "2001:db8::1234");
assert.equal(trustedIntakeIp(ip4, " X-Forwarded-For "), "203.0.113.10");
assert.equal(trustedIntakeIp(ip4, undefined), null, "No configured ingress must fail closed");
assert.equal(trustedIntakeIp(ip4, "x-vercel-ip-country"), null, "Untrusted header name is not an IP");
assert.equal(trustedIntakeIp(ip4, "cf-connecting-ip"), null, "No fallback to another header");
assert.equal(trustedIntakeIp(new Headers({ "x-forwarded-for": "203.0.113.10, 198.51.100.4" }), "x-forwarded-for"), null, "Forwarded chains are rejected");
// Fetch Headers normalizes whitespace. Use a raw-header stub for this invalid input.
assert.equal(trustedIntakeIp({ get: name => name === "x-forwarded-for" ? "203.0.113.10 " : null }, "x-forwarded-for"), null, "Noncanonical whitespace is rejected");
assert.equal(trustedIntakeIp(new Headers({ "x-forwarded-for": "bad-IP" }), "x-forwarded-for"), null);
assert.equal(trustedIntakeIp(new Headers({ "x-forwarded-for": "2001:db8::1234, 198.51.100.4" }), "x-forwarded-for"), null, "IPv6 forwarding chains are rejected");
assert.equal(trustedIntakeIp(new Headers({ "x-real-ip": "198.51.100.7" }), "x-real-ip"), "198.51.100.7");
const action = readFileSync("src/app/actions/public/intake.ts", "utf8");
assert.match(action, /trustedIntakeIp\(await headers\(\), process\.env\.KOL_INTAKE_TRUSTED_IP_HEADER\)/);
assert.doesNotMatch(action, /trustedIp\(await headers\(\)\)/, "Unsafe inline parser must not return");
console.log("KOL public intake trusted single IP header: PASS");
