"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireClient } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function claimAnonymousIntakeAction(formData: FormData): Promise<never> {
  const ticketId = String(formData.get("ticketId") ?? "").trim();
  if (!uuidPattern.test(ticketId)) {
    redirect("/client/support?support=error&code=invalid_ticket_id");
  }
  const role = await requireClient();
  if (!role.ok) redirect("/login?next=%2Fclient%2Fsupport");

  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/client/support?support=error&code=supabase_not_configured");

  // Never authorize from the phone/contact fields supplied on an anonymous ticket.
  // The RPC checks both the verified Supabase Auth email and active Client role.
  const requestId = `claim-anonymous-intake-${ticketId}-${randomUUID()}`;
  const { data, error } = await supabase.rpc("claim_anonymous_intake_by_verified_email_atomic", {
    p_ticket_id: ticketId,
    p_request_id: requestId
  });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    redirect("/client/support?support=error&code=claim_not_authorized");
  }
  const result = data as Record<string, unknown>;
  if (result.ok !== true || result.ticket_id !== ticketId) {
    redirect("/client/support?support=error&code=claim_not_confirmed");
  }
  revalidatePath("/client/support");
  revalidatePath("/admin/support");
  redirect(`/client/support?support=claimed&ticket=${encodeURIComponent(ticketId)}`);
}
