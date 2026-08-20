"use server";

import { randomUUID } from "node:crypto";
import { requirePartner } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const BUCKET = "catalog-media";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const mimeToExtension = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif"
} as const;

type CatalogMediaOwnerType = "menu_item" | "product" | "tour" | "stay";

type MediaActionResult = {
  ok: boolean;
  mediaId?: string;
  code?: string;
  message: string;
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function isOwnerType(value: string): value is CatalogMediaOwnerType {
  return value === "menu_item" || value === "product" || value === "tour" || value === "stay";
}

function ownerTable(ownerType: CatalogMediaOwnerType) {
  if (ownerType === "menu_item") return "menu_items";
  if (ownerType === "product") return "products";
  if (ownerType === "tour") return "tours";
  return "stays";
}

function fail(code: string, message: string): MediaActionResult {
  return { ok: false, code, message };
}

export async function uploadPartnerCatalogMediaAction(formData: FormData): Promise<MediaActionResult> {
  const partner = await requirePartner();
  if (!partner.ok || !partner.data.partnerId) {
    return fail("not_authorized", "Authenticated partner access is required.");
  }

  const rawOwnerType = formData.get("ownerType");
  const rawOwnerId = formData.get("ownerId");
  const rawAlt = formData.get("alt");
  const rawFile = formData.get("file");

  if (typeof rawOwnerType !== "string" || !isOwnerType(rawOwnerType)) {
    return fail("invalid_owner_type", "Unsupported media owner type.");
  }

  if (typeof rawOwnerId !== "string" || !isUuid(rawOwnerId)) {
    return fail("invalid_owner_id", "Invalid media owner id.");
  }

  if (!(rawFile instanceof File) || rawFile.size < 1 || rawFile.size > MAX_IMAGE_BYTES) {
    return fail("invalid_file_size", "Image must be between 1 byte and 8 MiB.");
  }

  const extension = mimeToExtension[rawFile.type as keyof typeof mimeToExtension];
  if (!extension) {
    return fail("invalid_file_type", "Only JPEG, PNG, WebP and AVIF images are accepted.");
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return fail("supabase_not_configured", "Supabase media storage is not configured.");
  }

  const businessId = partner.data.partnerId;
  const userId = partner.data.userId;
  const table = ownerTable(rawOwnerType);

  // Fail before upload if the requested catalog owner is not part of this business.
  const { data: ownerRow, error: ownerError } = await supabase
    .from(table)
    .select("id,business_id")
    .eq("id", rawOwnerId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (ownerError || !ownerRow) {
    return fail("owner_not_available", "Catalog item is not available for this partner.");
  }

  const storagePath = `${businessId}/${rawOwnerType}/${rawOwnerId}/${randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, rawFile, {
      contentType: rawFile.type,
      upsert: false,
      cacheControl: "3600"
    });

  if (uploadError) {
    return fail("storage_upload_failed", "Image could not be uploaded safely.");
  }

  const alt = typeof rawAlt === "string" ? rawAlt.trim().slice(0, 300) : null;
  const { data: mediaRow, error: metadataError } = await supabase
    .from("media_files")
    .insert({
      owner_type: rawOwnerType,
      owner_id: rawOwnerId,
      url: null,
      alt: alt || null,
      sort_order: 0,
      storage_bucket: BUCKET,
      storage_path: storagePath,
      mime_type: rawFile.type,
      size_bytes: rawFile.size,
      uploaded_by: userId
    })
    .select("id")
    .single();

  if (metadataError || !mediaRow?.id) {
    // Storage and Postgres are separate APIs. Compensate immediately so a failed
    // metadata write does not normally leave an orphaned object behind.
    await supabase.storage.from(BUCKET).remove([storagePath]);
    return fail("metadata_write_failed", "Image metadata could not be stored; upload was rolled back.");
  }

  return {
    ok: true,
    mediaId: mediaRow.id,
    message: "Catalog image uploaded with partner-scoped Storage policies."
  };
}

export async function deletePartnerCatalogMediaAction(mediaId: string): Promise<MediaActionResult> {
  if (!isUuid(mediaId)) {
    return fail("invalid_media_id", "Invalid media id.");
  }

  const partner = await requirePartner();
  if (!partner.ok || !partner.data.partnerId) {
    return fail("not_authorized", "Authenticated partner access is required.");
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return fail("supabase_not_configured", "Supabase media storage is not configured.");
  }

  const { data: media, error: readError } = await supabase
    .from("media_files")
    .select("id,storage_bucket,storage_path")
    .eq("id", mediaId)
    .maybeSingle();

  if (readError || !media?.storage_path || media.storage_bucket !== BUCKET) {
    return fail("media_not_available", "Media is not available for deletion.");
  }

  if (!media.storage_path.startsWith(`${partner.data.partnerId}/`)) {
    return fail("ownership_failed", "Media does not belong to this partner business.");
  }

  const { error: storageError } = await supabase.storage.from(BUCKET).remove([media.storage_path]);
  if (storageError) {
    return fail("storage_delete_failed", "Stored image could not be deleted safely.");
  }

  const { error: metadataError } = await supabase.from("media_files").delete().eq("id", mediaId);
  if (metadataError) {
    return fail(
      "metadata_delete_failed",
      "Stored image was deleted but metadata cleanup requires review."
    );
  }

  return { ok: true, mediaId, message: "Catalog image deleted." };
}
