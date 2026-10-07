import { isSupabaseMode } from "@/lib/data/data-source";
import { getMockPartners } from "@/lib/data/mock-data-source";
import { getPublicPartnersFromSupabase, type PublicPartnerBusiness } from "@/lib/data/public-partners-supabase";
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

  return getPublicPartnersFromSupabase();
}
