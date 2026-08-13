import { getMockPartners } from "@/lib/data/mock-data-source";
import { isSupabaseMode } from "@/lib/data/data-source";
import { readPartnerByIdFromSupabase, readPartnersFromSupabase } from "@/lib/data/supabase-read-adapter";

export function getPartners() {
  if (isSupabaseMode()) {
    const supabasePartners = readPartnersFromSupabase();

    if (supabasePartners.length > 0) {
      return supabasePartners;
    }
  }

  return getMockPartners();
}

export function getPartnerById(id: string) {
  if (isSupabaseMode()) {
    const supabasePartner = readPartnerByIdFromSupabase(id);

    if (supabasePartner) {
      return supabasePartner;
    }
  }

  return getPartners().find((partner) => partner.id === id);
}

export function getPartnerBySlug(slug: string) {
  return getPartners().find((partner) => partner.slug === slug);
}

// Future Supabase implementation should replace internals only, keeping this API stable.
