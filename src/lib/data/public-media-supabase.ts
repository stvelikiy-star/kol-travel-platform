import { createClient } from "@supabase/supabase-js";
import { getPublicSupabaseConfig } from "@/lib/supabase/types";

type CatalogMediaOwnerType = "menu_item" | "product" | "tour" | "stay";

type MediaMetadataRow = {
  id: string;
  owner_type: string;
  owner_id: string;
  alt: string | null;
  sort_order: number;
  storage_bucket: string | null;
  storage_path: string | null;
};

export type PublicCatalogMedia = {
  id: string;
  alt?: string;
  sortOrder: number;
  signedUrl: string;
};

export type PublicCatalogMediaResult = {
  ok: boolean;
  media: PublicCatalogMedia[];
  code?: string;
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function isOwnerType(value: string): value is CatalogMediaOwnerType {
  return value === "menu_item" || value === "product" || value === "tour" || value === "stay";
}

export async function getPublicCatalogMediaFromSupabase(
  ownerType: CatalogMediaOwnerType,
  ownerId: string
): Promise<PublicCatalogMediaResult> {
  if (!isOwnerType(ownerType) || !isUuid(ownerId)) {
    return { ok: false, media: [], code: "invalid_owner" };
  }

  const config = getPublicSupabaseConfig();
  if (!config.url || !config.publicKey) {
    return { ok: false, media: [], code: "supabase_not_configured" };
  }

  const supabase = createClient(config.url, config.publicKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });

  try {
    // Anon RLS on media_files only returns metadata for active catalog rows owned
    // by approved partners. No service-role bypass is used for public rendering.
    const { data, error } = await supabase
      .from("media_files")
      .select("id,owner_type,owner_id,alt,sort_order,storage_bucket,storage_path")
      .eq("owner_type", ownerType)
      .eq("owner_id", ownerId)
      .eq("storage_bucket", "catalog-media")
      .order("sort_order", { ascending: true });

    if (error || !Array.isArray(data)) {
      return { ok: false, media: [], code: "metadata_read_failed" };
    }

    const rows = (data as MediaMetadataRow[]).filter(
      (row) =>
        row.owner_type === ownerType &&
        row.owner_id === ownerId &&
        row.storage_bucket === "catalog-media" &&
        typeof row.storage_path === "string" &&
        row.storage_path.length > 0
    );

    const signed = await Promise.all(
      rows.map(async (row) => {
        const { data: signedData, error: signedError } = await supabase.storage
          .from("catalog-media")
          .createSignedUrl(row.storage_path!, 15 * 60);

        if (signedError || !signedData?.signedUrl) return null;

        return {
          id: row.id,
          alt: row.alt ?? undefined,
          sortOrder: Number.isFinite(row.sort_order) ? row.sort_order : 0,
          signedUrl: signedData.signedUrl
        } satisfies PublicCatalogMedia;
      })
    );

    return {
      ok: true,
      media: signed.filter((item): item is PublicCatalogMedia => item !== null)
    };
  } catch {
    return { ok: false, media: [], code: "server_error" };
  }
}
