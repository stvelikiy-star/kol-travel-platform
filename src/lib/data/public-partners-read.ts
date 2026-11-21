import { isSupabaseMode } from "@/lib/data/data-source";
import { getMockPartners } from "@/lib/data/mock-data-source";
import { getPublicPartnersFromSupabase, type PublicPartnerBusiness } from "@/lib/data/public-partners-supabase";
import { isShowcasePreview } from "@/lib/data/public-showcase";
import type { PublicCatalogReadResult } from "@/lib/data/types";

export type PublicPartnersReadResult = PublicCatalogReadResult<PublicPartnerBusiness>;

export async function getPublicPartnersReadResult(): Promise<PublicPartnersReadResult> {
  if (!isSupabaseMode()) {
    return {
      ok: true,
      source: "mock",
      items: getMockPartners().map(({ ownerUserId: _ownerUserId, ...partner }) => partner),
      message: "Public partners read from mock data."
    };
  }

  const supabaseResult = await getPublicPartnersFromSupabase();
  if (!isShowcasePreview()) {
    return supabaseResult;
  }

  const showcasePartners = getMockPartners()
    .filter((partner) => partner.type === "restaurant" || partner.type === "cafe" || partner.type === "shop")
    .map(({ ownerUserId: _ownerUserId, ...partner }) => partner);

  if (!supabaseResult.ok || supabaseResult.items.length === 0) {
    return {
      ok: true,
      source: "mock",
      items: showcasePartners,
      message: "Showcase partners read from mock data."
    };
  }

  const liveIds = new Set(supabaseResult.items.map((partner) => partner.id));
  return {
    ...supabaseResult,
    items: [...supabaseResult.items, ...showcasePartners.filter((partner) => !liveIds.has(partner.id))]
  };
}
