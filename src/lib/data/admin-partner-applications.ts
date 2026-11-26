import { requireSuperAdmin } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PartnerApplicationReview = {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  name: string;
  email: string;
  phone: string;
  businessName: string;
  businessType: string;
  location: string;
  comment: string;
};
type Result = { ok: true; applications: PartnerApplicationReview[] } | { ok: false; applications: []; reason: "denied" | "unavailable" };

function field(value: unknown): string {
  return typeof value === "string" ? value.slice(0, 500) : "";
}
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}
/** Partner applications stay ordinary support tickets until separately approved.
 * Reads are owner-only and never grant partner access or create businesses. */
export async function getPartnerApplicationsForReview(): Promise<Result> {
  const actor = await requireSuperAdmin();
  if (!actor.ok) return { ok: false, applications: [], reason: "denied" };
  try {
    const db = await createSupabaseServerClient();
    if (!db) return { ok: false, applications: [], reason: "unavailable" };
    const { data, error } = await db.from("support_tickets")
      .select("id,title,status,created_at,request_payload")
      .contains("request_payload", { request_type: "partner_application" })
      .order("created_at", { ascending: false }).limit(100);
    if (error || !data) return { ok: false, applications: [], reason: "unavailable" };
    const applications = data.map(row => {
      const payload = record(row.request_payload);
      const contact = record(payload.contact);
      const business = record(payload.business);
      return {
        id: row.id, title: field(row.title), status: field(row.status),
        createdAt: field(row.created_at),
        name: field(contact.name), email: field(contact.email), phone: field(contact.phone),
        businessName: field(business.name), businessType: field(business.type),
        location: field(business.location), comment: field(payload.comment)
      };
    });
    return { ok: true, applications };
  } catch {
    return { ok: false, applications: [], reason: "unavailable" };
  }
}
