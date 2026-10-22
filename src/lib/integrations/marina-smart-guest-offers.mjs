// MARINA SMART guest portal → KÖL public-catalog entry.
// Intentionally does not accept guest identity, hotel/room numbers, arbitrary URLs
// or attribution tokens. Referral tracking is a later authenticated API phase.
export const KOL_GUEST_OFFER_DESTINATIONS = Object.freeze({
  home: "/",
  tours: "/tours",
  food: "/delivery?tab=food",
  shop: "/delivery?tab=shop",
  delivery: "/delivery",
  stays: "/stays"
});

export function resolveKolGuestOfferPath(category) {
  if (typeof category !== "string" || !Object.hasOwn(KOL_GUEST_OFFER_DESTINATIONS, category)) {
    return null;
  }
  return KOL_GUEST_OFFER_DESTINATIONS[category];
}
