"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RoomAction = "approve" | "reject" | "publish" | "unpublish";
const validActions = new Set<RoomAction>(["approve", "reject", "publish", "unpublish"]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function finish(state: "success" | "error", action: string, code?: string): never {
  const values = new URLSearchParams({ roomAction: state, action });
  if (code) values.set("code", code);
  redirect(`/admin/catalog/rooms?${values.toString()}`);
}

export async function adminRoomLifecycleFormAction(formData: FormData): Promise<never> {
  const roomId = String(formData.get("roomId") ?? "");
  const action = String(formData.get("action") ?? "");
  const requestId = String(formData.get("requestId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!uuid.test(roomId)) return finish("error", action, "invalid_room_id");
  if (!validActions.has(action as RoomAction)) return finish("error", action, "invalid_action");
  if (requestId.length < 8 || requestId.length > 128) return finish("error", action, "invalid_request_id");
  if (reason.length < 3 || reason.length > 500) return finish("error", action, "reason_required");

  const actor = await requireSuperAdmin();
  if (!actor.ok) return finish("error", action, "not_authorized");
  const supabase = await createSupabaseServerClient();
  if (!supabase) return finish("error", action, "not_configured");

  const { data, error } = await supabase.rpc("admin_room_lifecycle_atomic", {
    p_room_id: roomId,
    p_action: action,
    p_request_id: requestId,
    p_reason: reason
  });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    return finish("error", action, "room_action_rejected");
  }
  const result = data as Record<string, unknown>;
  if (result.ok !== true || result.room_id !== roomId) {
    return finish("error", action, "room_action_not_applied");
  }
  revalidatePath("/admin/catalog/rooms");
  revalidatePath("/admin/catalog/stays");
  revalidatePath("/partner/availability/rooms");
  revalidatePath("/stays");
  return finish("success", action);
}
