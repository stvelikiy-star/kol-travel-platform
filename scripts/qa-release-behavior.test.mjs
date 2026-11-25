import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { managedRoles, managedAdminRoles, managedPartnerRoles, isManagedRole, isManagedPartnerRole, canSwitchManagedRole } from "../src/lib/auth/managed-access-policy.ts";
import { trustedIntakeIp } from "../src/lib/intake/trusted-ip.ts";
import { resolveIntakeHmacSecret, hashIntakeIdentifier } from "../src/lib/intake/hmac-secret.ts";
import { currentBishkekFinanceMonth } from "../src/lib/finance/report-period.ts";

const goodHmac = "independent_kol_hmac_key_for_QA_only_2026_".padEnd(56, "a");
for (const role of managedRoles) {
  test("staff invitation accepts managed role: " + role, () => {
    assert.equal(isManagedRole(role), true);
  });
}
for (const role of ["guest", "client", "super_admin", "ai_dispatcher_system", "owner", "", "finance-owner"]) {
  test("staff invitation rejects protected or unknown role: " + (role || "empty"), () => {
    assert.equal(isManagedRole(role), false);
  });
}
for (const role of managedRoles) {
  test("role updates preserve account family: " + role, () => {
    for (const next of managedRoles) {
      const sameFamily =
        managedAdminRoles.includes(role) && managedAdminRoles.includes(next) ||
        managedPartnerRoles.includes(role) && managedPartnerRoles.includes(next);
      assert.equal(canSwitchManagedRole(role, next), role !== next && sameFamily,
        role + " -> " + next);
    }
  });
}
for (const role of ["partner_owner", "partner_manager", "partner_staff", "dispatcher", "finance_admin", "courier"]) {
  test("partner identity classification: " + role, () => {
    assert.equal(isManagedPartnerRole(role), managedPartnerRoles.includes(role));
  });
}
test("IPv4 from the configured trusted ingress header", () => {
  assert.equal(trustedIntakeIp(new Headers({ "x-forwarded-for": "198.51.100.17" }), "x-forwarded-for"), "198.51.100.17");
});
test("IPv6 from the configured trusted ingress header", () => {
  assert.equal(trustedIntakeIp(new Headers({ "cf-connecting-ip": "2001:db8::14" }), "cf-connecting-ip"), "2001:db8::14");
});
test("missing trusted ingress configuration fails closed", () => {
  assert.equal(trustedIntakeIp(new Headers({ "x-forwarded-for": "198.51.100.17" }), undefined), null);
});
test("unapproved header fails closed", () => {
  assert.equal(trustedIntakeIp(new Headers({ "client-ip": "198.51.100.17" }), "client-ip"), null);
});
test("forwarded comma chains fail closed", () => {
  assert.equal(trustedIntakeIp(new Headers({ "x-forwarded-for": "198.51.100.17, 198.51.100.18" }), "x-forwarded-for"), null);
});
test("header value mismatch does not fall back", () => {
  assert.equal(trustedIntakeIp(new Headers({ "x-forwarded-for": "198.51.100.17" }), "x-real-ip"), null);
});
test("non-canonical raw header whitespace is rejected", () => {
  assert.equal(trustedIntakeIp({ get: () => "198.51.100.17 " }, "x-forwarded-for"), null);
});
test("malformed IP rejected", () => {
  assert.equal(trustedIntakeIp(new Headers({ "x-forwarded-for": "999.999.999.999" }), "x-forwarded-for"), null);
});
test("independent HMAC secret accepted", () => {
  assert.equal(resolveIntakeHmacSecret(goodHmac, "a-different-service-role-value"), goodHmac);
});
test("HMAC secret missing: fail closed", () => {
  assert.throws(() => resolveIntakeHmacSecret(undefined, "service"), /missing_or_weak/);
});
test("HMAC secret short: fail closed", () => {
  assert.throws(() => resolveIntakeHmacSecret("short", "service"), /missing_or_weak/);
});
test("HMAC secret with spaces: fail closed", () => {
  assert.throws(() => resolveIntakeHmacSecret("x".repeat(35) + " ", "service"), /missing_or_weak/);
});
test("HMAC key must differ from Supabase service-role credential", () => {
  assert.throws(() => resolveIntakeHmacSecret(goodHmac, goodHmac), /must_be_independent/);
});
test("phone HMAC digest stable and SHA-256 length", () => {
  const first = hashIntakeIdentifier(goodHmac, "phone", "996555123456");
  assert.equal(first.length, 64);
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(first, hashIntakeIdentifier(goodHmac, "phone", "996555123456"));
});
test("different phone, identifier type or key must change HMAC", () => {
  const original = hashIntakeIdentifier(goodHmac, "phone", "996555123456");
  assert.notEqual(original, hashIntakeIdentifier(goodHmac, "phone", "996555123457"));
  assert.notEqual(original, hashIntakeIdentifier(goodHmac, "ip", "996555123456"));
  assert.notEqual(original, hashIntakeIdentifier(goodHmac + "X", "phone", "996555123456"));
});
test("unsupported HMAC identifier kind denied", () => {
  assert.throws(() => hashIntakeIdentifier(goodHmac, "email", "sample@example.invalid"), /identifier_invalid/);
});
for (const [timestamp, expectedStart, expectedEnd] of [
  ["2026-11-01T00:00:00.000Z", "2026-11-01", "2026-12-01"],
  ["2026-11-30T18:01:00.000Z", "2026-12-01", "2027-01-01"],
  ["2026-12-31T17:59:59.000Z", "2026-12-01", "2027-01-01"],
  ["2026-12-31T18:01:00.000Z", "2027-01-01", "2027-02-01"],
  ["2028-02-29T17:59:00.000Z", "2028-02-01", "2028-03-01"]
]) {
  test("Bishkek finance period boundary " + timestamp, () => {
    assert.deepEqual(currentBishkekFinanceMonth(new Date(timestamp)), { from: expectedStart, toExclusive: expectedEnd });
  });
}

// Browser bundles deliberately cannot read server-only DATA_SOURCE_MODE.
test("staff invite browser Auth follows the trusted SSR data source mode", () => {
  const layout = readFileSync("src/app/layout.tsx", "utf8");
  const browser = readFileSync("src/lib/supabase/client.ts", "utf8");
  assert.match(layout, /data-kol-data-source-mode=\{getDataSourceMode\(\)\}/);
  assert.match(browser, /document\.documentElement\.dataset\.kolDataSourceMode\s*!==\s*"supabase"/);
  assert.doesNotMatch(browser, /isSupabaseMode\(\)|process\.env\.DATA_SOURCE_MODE/);
  assert.match(browser, /if\s*\(!config\.url\s*\|\|\s*!config\.publicKey\)/);
});
