import { requireAdmin } from "@/lib/auth/roles";
import { getAuthenticatedRestConfig, getAuthenticatedRestHeaders } from "@/lib/data/authenticated-read-utils";
import type { BusinessStatus, PartnerStatus, PartnerType, PartnerBusiness } from "@/types";

export type AdminPartnerBusiness = Omit<PartnerBusiness, "ownerUserId">;
export type AdminPartnersReadCode = "supabase_not_configured" | "read_failed" | "empty_result" | "server_error";
export type AdminPartnersReadResult = {
  ok: boolean;
  source: "mock" | "supabase";
  partners: AdminPartnerBusiness[];
  code?: AdminPartnersReadCode;
  message?: string;
};

function makeResult(input: Omit<AdminPartnersReadResult, "source" | "partners"> & { partners?: AdminPartnerBusiness[] }): AdminPartnersReadResult {
  return { ...input, source: "supabase", partners: input.partners ?? [] };
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function text(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
function numberValue(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}
function partnerType(value: unknown): PartnerType | null {
  if (["hotel", "guest_house", "restaurant", "cafe", "shop", "tour_operator", "guide", "delivery_service"].includes(String(value))) return value as PartnerType;
  return null;
}
function partnerStatus(value: unknown): PartnerStatus | null {
  if (["pending", "approved", "suspended", "rejected", "archived"].includes(String(value))) return value as PartnerStatus;
  return null;
}
function businessStatus(value: unknown): BusinessStatus | null {
  if (["online", "paused", "offline"].includes(String(value))) return value as BusinessStatus;
  return null;
}
function mapPartner(row: unknown): AdminPartnerBusiness | null {
  if (!record(row)) return null;
  const type = partnerType(row.type);
  const status = partnerStatus(row.status);
  const currentBusinessStatus = businessStatus(row.business_status);
  if (!text(row.id) || !type || !text(row.title) || !text(row.slug) || !status || !currentBusinessStatus) return null;
  return {
    id: row.id,
    type,
    title: row.title,
    slug: row.slug,
    location: text(row.location) ? row.location : "Иссык-Куль",
    description: text(row.description) ? row.description : "",
    status,
    businessStatus: currentBusinessStatus,
    rating: numberValue(row.rating)
  };
}

export async function getAdminPartnersFromSupabase(): Promise<AdminPartnersReadResult> {
  try {
    const [config, admin] = await Promise.all([getAuthenticatedRestConfig(), requireAdmin()]);
    if (!config) return makeResult({ ok: false, code: "supabase_not_configured", message: "Supabase read environment is not configured." });
    if (!admin.ok || config.userId !== admin.data.userId) return makeResult({ ok: false, code: "read_failed", message: "Admin partners are not available for this authenticated identity." });
    const url = new URL(`${config.restUrl}/partners`);
    url.searchParams.set("select", "id,type,title,slug,description,location,status,business_status,rating");
    url.searchParams.set("type", "neq.alcohol_partner");
    url.searchParams.set("order", "updated_at.desc");
    const response = await fetch(url.toString(), { method: "GET", headers: getAuthenticatedRestHeaders(config), cache: "no-store" });
    if (!response.ok) return makeResult({ ok: false, code: "read_failed", message: "Admin partners could not be read safely." });
    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) return makeResult({ ok: false, code: "read_failed", message: "Admin partners response was invalid." });
    const mapped = payload.map(mapPartner);
    if (mapped.some((item) => item === null)) return makeResult({ ok: false, code: "read_failed", message: "Admin partners response contained malformed data." });
    const partners = mapped as AdminPartnerBusiness[];
    if (!partners.length) return makeResult({ ok: false, partners, code: "empty_result", message: "No admin partners were found." });
    return makeResult({ ok: true, partners, message: "Admin partners read from Supabase." });
  } catch {
    return makeResult({ ok: false, code: "server_error", message: "Admin partners read failed safely." });
  }
}
