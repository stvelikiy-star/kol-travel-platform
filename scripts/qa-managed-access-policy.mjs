import assert from "node:assert/strict";
import { isManagedRole, isManagedPartnerRole, canSwitchManagedRole, managedRoles } from "../src/lib/auth/managed-access-policy.ts";

for (const forbidden of ["guest", "client", "super_admin", "ai_dispatcher_system", "", "owner"]) {
  assert.equal(isManagedRole(forbidden), false, "Protected role must not be assignable: " + forbidden);
}
for (const role of managedRoles) assert.equal(isManagedRole(role), true);
assert.equal(isManagedPartnerRole("partner_owner"), true);
assert.equal(isManagedPartnerRole("courier"), false);
assert.equal(canSwitchManagedRole("dispatcher", "finance_admin"), true);
assert.equal(canSwitchManagedRole("partner_owner", "partner_manager"), true);
assert.equal(canSwitchManagedRole("courier", "finance_admin"), false);
assert.equal(canSwitchManagedRole("partner_owner", "finance_admin"), false);
assert.equal(canSwitchManagedRole("content_manager", "partner_staff"), false);
assert.equal(canSwitchManagedRole("support_admin", "support_admin"), false);
console.log("KÖL managed role policy: PASS (client and super admin protected, scope boundaries enforced)");
