"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type WriteCode = "saved" | "published" | "archived" | "channel_saved"
  | "invalid_input" | "not_authorized" | "unavailable" | "conflict_or_rejected";
export type AiAdminWriteResult = { ok: boolean; code: WriteCode };
const acceptedLocales = new Set(["ru", "ky", "en"]);
const acceptedKinds = new Set(["faq", "script", "guide", "policy", "handoff"]);
const acceptedAudiences = new Set(["public", "client", "partner", "staff", "admin"]);
const acceptedChannels = new Set(["web", "whatsapp", "telegram"]);
const keyPattern = /^[a-z][a-z0-9_.-]{2,79}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function refresh() {
  for (const root of ["/admin/ai", "/editor/ai"]) {
    revalidatePath(root);
    revalidatePath(root + "/knowledge");
    revalidatePath(root + "/channels");
  }
}
function failure(code: WriteCode): AiAdminWriteResult {
  return { ok: false, code };
}

export async function saveAiKnowledge(formData: FormData): Promise<AiAdminWriteResult> {
  const role = await requireRole(["super_admin", "content_manager"]);
  if (!role.ok) return failure("not_authorized");
  const id = String(formData.get("id") ?? "").trim();
  const material_key = String(formData.get("material_key") ?? "").trim();
  const locale = String(formData.get("locale") ?? "");
  const kind = String(formData.get("kind") ?? "");
  const audience = String(formData.get("audience") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const source_url = String(formData.get("source_url") ?? "").trim();
  const version = Number(formData.get("version"));
  const priority = Number(formData.get("priority") ?? "100");
  if (!keyPattern.test(material_key) || !acceptedLocales.has(locale) ||
      !acceptedKinds.has(kind) || !acceptedAudiences.has(audience) ||
      title.length < 3 || title.length > 150 ||
      body.length === 0 || body.length > 8000 ||
      source_url.length > 600 || (source_url && !/^https:\/\/[^\s]+$/.test(source_url)) ||
      !Number.isSafeInteger(priority) || priority < 0 || priority > 999 ||
      (id !== "" && (!uuidPattern.test(id) || !Number.isSafeInteger(version) || version < 1))) {
    return failure("invalid_input");
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) return failure("unavailable");
  const record = {
    material_key,locale,kind,audience,title,body,
    source_url: source_url || null,priority,status:"draft",
    updated_by:role.data.userId
  };
  try {
    if (id) {
      // Optimistic locking: editing a published answer always reverts to draft,
      // never silently replaces the live approved instructions.
      const { data,error } = await supabase.from("kol_ai_materials_v1")
        .update(record).eq("id",id).eq("version",version)
        .select("id").maybeSingle();
      if (error || !data) return failure("conflict_or_rejected");
    } else {
      const { error } = await supabase.from("kol_ai_materials_v1").insert(record);
      if (error) return failure("conflict_or_rejected");
    }
    refresh();
    return {ok:true,code:"saved"};
  } catch {
    return failure("unavailable");
  }
}

export async function setAiKnowledgeStatus(formData: FormData): Promise<AiAdminWriteResult> {
  const role = await requireRole(["super_admin","content_manager"]);
  if (!role.ok) return failure("not_authorized");
  const id = String(formData.get("id") ?? "");
  const intent = String(formData.get("intent") ?? "");
  const version = Number(formData.get("version"));
  if (!uuidPattern.test(id) || !["publish","archive"].includes(intent) ||
      !Number.isSafeInteger(version) || version < 1) return failure("invalid_input");
  const supabase = await createSupabaseServerClient();
  if (!supabase) return failure("unavailable");
  try {
    const status = intent === "publish" ? "published" : "archived";
    const q = supabase.from("kol_ai_materials_v1")
      .update({status,updated_by:role.data.userId})
      .eq("id",id).eq("version",version);
    const {data,error} = await q.select("id").maybeSingle();
    if (error || !data) return failure("conflict_or_rejected");
    refresh();
    return {ok:true,code:status};
  } catch {
    return failure("unavailable");
  }
}

export async function saveAiChannelSettings(formData: FormData): Promise<AiAdminWriteResult> {
  const role = await requireRole(["super_admin","content_manager"]);
  if (!role.ok) return failure("not_authorized");
  const channel = String(formData.get("channel") ?? "");
  const route_hint = String(formData.get("route_hint") ?? "");
  const admin_note = String(formData.get("admin_note") ?? "").trim();
  if (!acceptedChannels.has(channel) ||
      !/^\/[a-z0-9/_-]*$/.test(route_hint) || route_hint.length >= 140 ||
      admin_note.length > 1000) return failure("invalid_input");
  const supabase = await createSupabaseServerClient();
  if (!supabase) return failure("unavailable");
  try {
    // Deliberately no enabled/auto_reply/provider/secret fields in the update.
    const {data,error} = await supabase.from("kol_ai_channels_v1")
      .update({route_hint,admin_note,updated_by:role.data.userId,updated_at:new Date().toISOString()})
      .eq("channel",channel).select("channel").maybeSingle();
    if (error || !data) return failure("conflict_or_rejected");
    refresh();
    return {ok:true,code:"channel_saved"};
  } catch {
    return failure("unavailable");
  }
}
