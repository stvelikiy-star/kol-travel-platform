"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/roles";
import { isSupabaseMode } from "@/lib/data/data-source";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type AdminIssueTransitionResult = {
  ok: boolean;
  code?: string;
  status?: string;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const allowedStates = new Set(["open", "in_review", "resolved"]);

export async function transitionAdminDeliveryIssueAction(
  issueId: string,
  toStatus: string,
  requestId: string,
  reason: string
): Promise<AdminIssueTransitionResult> {
  const admin = await requireRole(["super_admin", "support_admin", "dispatcher"]);
  if (!admin.ok) return { ok: false, code: "not_authorized" };
  if (!isSupabaseMode()) return { ok: false, code: "live_mode_required" };

  if (!uuidPattern.test(issueId) || !uuidPattern.test(requestId) ||
      !allowedStates.has(toStatus)) {
    return { ok: false, code: "invalid_request" };
  }
  const text = reason.trim();
  if (text.length < 10 || text.length > 500) return { ok: false, code: "reason_required" };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, code: "service_unavailable" };

  const { data, error } = await supabase.rpc("admin_delivery_issue_transition_atomic", {
    p_issue_id: issueId,
    p_to_status: toStatus,
    p_request_id: requestId,
    p_reason: text
  });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, code: error?.code === "23505" ? "request_conflict" : "transition_rejected" };
  }

  const result = data as Record<string, unknown>;
  if (result.ok !== true || result.issue_id !== issueId || result.status !== toStatus) {
    return { ok: false, code: "invalid_rpc_result" };
  }
  revalidatePath("/admin/delivery");
  revalidatePath("/courier/issues");
  return { ok: true, status: toStatus };
}
