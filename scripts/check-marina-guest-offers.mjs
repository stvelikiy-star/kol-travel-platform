import assert from "node:assert/strict";
import { KOL_GUEST_OFFER_DESTINATIONS, resolveKolGuestOfferPath } from "../src/lib/integrations/marina-smart-guest-offers.mjs";

for (const [category, path] of Object.entries(KOL_GUEST_OFFER_DESTINATIONS)) {
  assert.equal(resolveKolGuestOfferPath(category), path);
  assert(path.startsWith("/") && !path.startsWith("//"), "Destination must be relative");
  assert(!/[#]/.test(path), "Destination must not encode a token in fragment");
}
for (const unsafe of [
  null, undefined, "", "https://example.com", "//example.com", "../admin",
  "rooms/205", "hotel-123", "__proto__", "constructor", "toString",
  "food?guest=private", "admin"
]) {
  assert.equal(resolveKolGuestOfferPath(unsafe), null, "Unknown category must fail closed");
}
console.log("KÖL guest offer allowlist: PASS; no guest tokens or hotel identifiers embedded");
