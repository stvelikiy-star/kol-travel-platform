import { isSupabaseMode } from "@/lib/data/data-source";
import { getMockPartners } from "@/lib/data/mock-data-source";
import { getAdminPartnersFromSupabase, type AdminPartnersReadResult } from "@/lib/data/admin-partners-supabase";

export type { AdminPartnersReadResult } from "@/lib/data/admin-partners-supabase";

export async function getAdminPartnersReadResult(): Promise<AdminPartnersReadResult> {
  if (!isSupabaseMode()) {
    return {
      ok: true,
      source: "mock",
      partners: getMockPartners().map(({ ownerUserId: _ownerUserId, ...partner }) => partner),
      message: "Admin partners read from mock data."
    };
  }
  return getAdminPartnersFromSupabase();
}
