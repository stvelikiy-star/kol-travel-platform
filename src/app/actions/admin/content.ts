"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ContentWriteResult = {
  ok: boolean;
  code: "ok" | "not_authorized" | "invalid_input" | "unavailable" | "write_rejected";
  version?: number;
};

const keyPattern = /^[a-z0-9_.-]{3,80}$/;
const locales = new Set(["ru","ky","en"]);
const operations = new Set(["draft","publish","restore"]);

export async function saveSiteContent(formData: FormData): Promise<ContentWriteResult> {
  return writeContent("draft",formData);
}
export async function publishSiteContent(formData: FormData): Promise<ContentWriteResult> {
  return writeContent("publish",formData);
}
export async function restoreSiteContent(formData: FormData): Promise<ContentWriteResult> {
  return writeContent("restore",formData);
}
async function writeContent(operation: "draft" | "publish" | "restore", formData: FormData): Promise<ContentWriteResult> {
  if (!operations.has(operation)) return {ok:false,code:"invalid_input"};
  const key = String(formData.get("content_key") ?? "");
  const locale = String(formData.get("locale") ?? "");
  const value = operation==="draft" ? String(formData.get("value") ?? "") : null;
  const suppliedVersion = operation==="draft" ? null : Number(formData.get("version"));
  if (!keyPattern.test(key)||!locales.has(locale) ||
      (value!==null && value.length>2000) ||
      (operation!=="draft" && (!Number.isSafeInteger(suppliedVersion) || suppliedVersion===null || suppliedVersion<1))) {
    return {ok:false,code:"invalid_input"};
  }
  const actor = await requireRole(["super_admin","content_manager"]);
  if (!actor.ok) return {ok:false,code:"not_authorized"};
  const supabase = await createSupabaseServerClient();
  if (!supabase) return {ok:false,code:"unavailable"};
  try {
    const {data,error} = await supabase.rpc("kol_site_content_write_v1",{
      p_operation:operation,p_key:key,p_locale:locale,p_value:value,p_version:suppliedVersion
    });
    if (error||!data||typeof data!=="object"||Array.isArray(data)) {
      return {ok:false,code:"write_rejected"};
    }
    const reply=data as Record<string,unknown>;
    if (reply.ok!==true || reply.key!==key || reply.locale!==locale || reply.operation!==operation ||
        typeof reply.version!=="number") {
      return {ok:false,code:"write_rejected"};
    }
    if(operation!=="draft") {
      revalidatePath("/");
      revalidatePath("/stays");
      revalidatePath("/tours");
      revalidatePath("/delivery");
      revalidatePath("/transfer");
    }
    return {ok:true,code:"ok",version:reply.version};
  } catch {
    return {ok:false,code:"unavailable"};
  }
}
