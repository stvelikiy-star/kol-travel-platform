"use server";

import { randomUUID } from "node:crypto";
import { requireRole } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { saveSiteContent } from "@/app/actions/admin/content";

const bucket = "site-visuals";
const maxBytes = 4 * 1024 * 1024;
const kindToKey = {
  background: "home.visual.background",
  banner: "home.visual.banner"
} as const;

export type VisualUploadResult = {
  ok: boolean;
  code: "ok" | "not_authorized" | "invalid_input" | "unavailable" | "storage_failed" | "draft_failed";
};

function imageType(bytes: Uint8Array): { mime: string; extension: string } | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return { mime: "image/jpeg", extension: "jpg" };
  if (bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((b,i) => bytes[i] === b))
    return { mime: "image/png", extension: "png" };
  if (bytes.length >= 12 && bytes[0] === 82 && bytes[1] === 73 && bytes[2] === 70 && bytes[3] === 70 &&
      bytes[8] === 87 && bytes[9] === 69 && bytes[10] === 66 && bytes[11] === 80)
    return { mime: "image/webp", extension: "webp" };
  return null;
}

export async function uploadSiteVisual(formData: FormData): Promise<VisualUploadResult> {
  const actor = await requireRole(["super_admin", "content_manager"]);
  if (!actor.ok) return { ok:false, code:"not_authorized" };
  const kind = formData.get("kind");
  const file = formData.get("file");
  if (kind !== "background" && kind !== "banner") return { ok:false, code:"invalid_input" };
  if (!(file instanceof File) || file.size < 32 || file.size > maxBytes) return { ok:false, code:"invalid_input" };
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    return { ok:false, code:"invalid_input" };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const verified = imageType(bytes);
  if (!verified || file.type !== verified.mime) return { ok:false, code:"invalid_input" };

  const db = await createSupabaseServerClient();
  if (!db) return { ok:false, code:"unavailable" };
  const storagePath = `${kind}/${randomUUID()}.${verified.extension}`;
  try {
    const uploaded = await db.storage.from(bucket).upload(storagePath, bytes, {
      contentType: verified.mime, cacheControl: "3600", upsert: false
    });
    if (uploaded.error) return { ok:false, code:"storage_failed" };
    const url = db.storage.from(bucket).getPublicUrl(storagePath).data.publicUrl;
    const draft = new FormData();
    draft.set("content_key", kindToKey[kind]);
    draft.set("locale", "ru");
    draft.set("value", url);
    const saved = await saveSiteContent(draft);
    // Do not delete after a failed DB write: the upload may already be referenced
    // by another simultaneous editor; retain it for an explicit orphan audit.
    if (!saved.ok) return { ok:false, code:"draft_failed" };
    return { ok:true, code:"ok" };
  } catch {
    return { ok:false, code:"unavailable" };
  }
}
