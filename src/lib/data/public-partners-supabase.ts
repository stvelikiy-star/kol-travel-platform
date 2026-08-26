import type { BusinessStatus, PartnerStatus, PartnerType, PartnerBusiness } from "@/types";
import type { PublicCatalogReadResult } from "@/lib/data/types";

export type PublicPartnerBusiness = Omit<PartnerBusiness, "ownerUserId">;

type SupabasePublicPartnerRow = {
  id: string;
  type: string;
  title: string;
  slug: string;
  description: string | null;
  location: string | null;
  status: string;
  business_status: string;
  rating: number | string | null;
};

const publicPartnerFields = [
  "id",
  "type",
  "title",
  "slug",
  "description",
  "location",
  "status",
  "business_status",
  "rating"
].join(",");

const publicReadTimeoutMs = 1500;

function getSupabaseReadConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY;

  if (!url || !publicKey) return null;

  return {
    restUrl: `${url.replace(/\/$/, "")}/rest/v1`,
    publicKey
  };
}

function toNumber(value: number | string | null | undefined, fallback = 0) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function toPartnerType(value: string): PartnerType | null {
  switch (value) {
    case "hotel":
    case "guest_house":
    case "restaurant":
    case "cafe":
    case "shop":
    case "tour_operator":
    case "guide":
    case "delivery_service":
      return value;
    case "alcohol_partner":
    default:
      return null;
  }
}

function toPartnerStatus(value: string): PartnerStatus {
  switch (value) {
    case "approved":
    case "pending":
    case "suspended":
    case "rejected":
    case "archived":
      return value;
    default:
      return "pending";
  }
}

function toBusinessStatus(value: string): BusinessStatus {
  switch (value) {
    case "online":
    case "paused":
    case "offline":
      return value;
    default:
      return "offline";
  }
}

function mapPartner(row: SupabasePublicPartnerRow): PublicPartnerBusiness | null {
  const type = toPartnerType(row.type);
  if (!type) return null;

  return {
    id: row.id,
    type,
    title: row.title,
    slug: row.slug,
    location: row.location ?? "Иссык-Куль",
    description: row.description ?? "",
    status: toPartnerStatus(row.status),
    businessStatus: toBusinessStatus(row.business_status),
    rating: toNumber(row.rating)
  };
}

function result(input: {
  ok: boolean;
  items?: PublicPartnerBusiness[];
  code?: PublicCatalogReadResult<PublicPartnerBusiness>["code"];
  message?: string;
}): PublicCatalogReadResult<PublicPartnerBusiness> {
  return {
    ok: input.ok,
    source: "supabase",
    items: input.items ?? [],
    code: input.code,
    message: input.message
  };
}

export async function getPublicPartnersFromSupabase(): Promise<PublicCatalogReadResult<PublicPartnerBusiness>> {
  const config = getSupabaseReadConfig();
  if (!config) {
    return result({ ok: false, code: "supabase_not_configured", message: "Supabase public partner read is not configured." });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), publicReadTimeoutMs);
    const url = new URL(`${config.restUrl}/partners`);
    url.searchParams.set("select", publicPartnerFields);
    url.searchParams.set("status", "eq.approved");
    url.searchParams.set("type", "neq.alcohol_partner");
    url.searchParams.set("order", "title.asc");

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        apikey: config.publicKey,
        accept: "application/json"
      },
      cache: "no-store",
      signal: controller.signal
    }).finally(() => clearTimeout(timeout));

    if (response.status === 404) {
      return result({ ok: false, code: "table_missing", message: "Public partners table is not available." });
    }
    if (!response.ok) {
      return result({ ok: false, code: "read_failed", message: "Public partner data could not be read safely." });
    }

    const rows = (await response.json()) as SupabasePublicPartnerRow[];
    const items = rows.map(mapPartner).filter((item): item is PublicPartnerBusiness => item !== null);

    if (items.length === 0) {
      return result({ ok: false, items, code: "empty_result", message: "No approved public partners were found." });
    }

    return result({ ok: true, items, message: "Public partners read from Supabase." });
  } catch {
    return result({ ok: false, code: "server_error", message: "Public partner read failed safely." });
  }
}
