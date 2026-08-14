import { getMockPartners } from "@/lib/data/mock-data-source";
import { isSupabaseMode } from "@/lib/data/data-source";
import { readPartnerByIdFromSupabase, readPartnersFromSupabase } from "@/lib/data/supabase-read-adapter";
import {
  failedPartnerRead,
  getAuthenticatedPartnerReadContext,
  readAuthenticatedRows,
  type PartnerReadResult
} from "@/lib/data/authenticated-read-utils";

export type PartnerCabinetSummary = {
  id: string;
  title: string;
  type: string;
  location: string;
  rating: number;
  businessStatus: string;
};

export function getPartners() {
  if (isSupabaseMode()) {
    return readPartnersFromSupabase();
  }

  return getMockPartners();
}

export function getPartnerById(id: string) {
  if (isSupabaseMode()) {
    return readPartnerByIdFromSupabase(id) ?? undefined;
  }

  return getPartners().find((partner) => partner.id === id);
}

export function getPartnerBySlug(slug: string) {
  return getPartners().find((partner) => partner.slug === slug);
}

export async function getPartnerCabinetSummaryReadResult(): Promise<PartnerReadResult<PartnerCabinetSummary>> {
  if (!isSupabaseMode()) {
    const partners = getMockPartners();
    const partner = partners[2] ?? partners[0];

    if (!partner) {
      return {
        ok: true,
        data: {
          id: "mock-partner",
          title: "Demo Partner",
          type: "restaurant",
          location: "Иссык-Куль",
          rating: 4.8,
          businessStatus: "online"
        },
        source: "mock"
      };
    }

    return { ok: true, data: partner, source: "mock" };
  }

  const context = await getAuthenticatedPartnerReadContext();

  if (!context) {
    return failedPartnerRead();
  }

  const rows = await readAuthenticatedRows(context.rest, "partners", {
    select: "id,title,type,location,rating,business_status",
    id: `eq.${context.businessId}`,
    limit: "2"
  });

  if (rows?.length !== 1 || typeof rows[0] !== "object" || rows[0] === null) {
    return failedPartnerRead();
  }

  const row = rows[0] as Record<string, unknown>;

  if (
    row.id !== context.businessId ||
    typeof row.title !== "string" ||
    row.title.trim().length === 0 ||
    typeof row.type !== "string" ||
    row.type.trim().length === 0 ||
    typeof row.location !== "string" ||
    row.location.trim().length === 0 ||
    typeof row.rating !== "number" ||
    !Number.isFinite(row.rating) ||
    typeof row.business_status !== "string" ||
    row.business_status.trim().length === 0
  ) {
    return failedPartnerRead();
  }

  return {
    ok: true,
    data: {
      id: context.businessId,
      title: row.title,
      type: row.type,
      location: row.location,
      rating: row.rating,
      businessStatus: row.business_status
    },
    source: "supabase"
  };
}

// Future Supabase implementation should replace internals only, keeping this API stable.
