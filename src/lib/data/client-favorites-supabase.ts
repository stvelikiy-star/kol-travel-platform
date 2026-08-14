import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireClient } from "@/lib/auth/roles";

import type {
  ClientFavoriteItem,
  ClientFavoriteKind,
  ClientFavoritesReadResult
} from "@/lib/types/client-favorites";

type FavoriteRow = Record<string, unknown>;

export async function readClientFavoritesFromSupabase(): Promise<ClientFavoritesReadResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return unavailable();
  }

  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll: () => cookieStore.getAll(),
        // Pages only read data. Session-cookie refresh remains the middleware's job.
        setAll: () => undefined
      }
    });
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      return unavailable();
    }

    const client = await requireClient();

    if (!client.ok || client.data.userId !== authData.user.id) {
      return unavailable();
    }

    const { data, error } = await supabase
      .from("favorites")
      .select("*")
      .eq("user_id", authData.user.id)
      .order("created_at", { ascending: false });

    if (error || !data) {
      return unavailable();
    }

    const items = (data as FavoriteRow[]).map((row) => toFavoriteItem(row, authData.user.id));

    if (items.some((item) => item === null)) {
      return unavailable();
    }

    return {
      items: items as ClientFavoriteItem[],
      source: "supabase",
      status: "ready"
    };
  } catch {
    return unavailable();
  }
}

function unavailable(): ClientFavoritesReadResult {
  return { items: [], source: "supabase", status: "unavailable" };
}

function toFavoriteItem(row: FavoriteRow, userId: string): ClientFavoriteItem | null {
  if (firstString(row.user_id) !== userId) {
    return null;
  }

  const id = firstString(row.id);
  const targetId = firstString(row.target_id, row.item_id, row.entity_id, row.reference_id);
  const rawKind = firstString(row.favorite_type, row.target_type, row.item_type, row.entity_type, row.type);
  const kind = normalizeKind(rawKind);

  if (!id || !targetId || !kind) {
    return null;
  }

  const defaults = favoriteDefaults(kind, targetId);

  return {
    badge: firstString(row.category, row.location) ?? defaults.badge,
    description: firstString(row.description) ?? "Сохранено в избранном.",
    href: defaults.href,
    id,
    kind,
    meta: firstString(row.meta) ?? "В избранном",
    title: firstString(row.title, row.name, row.label) ?? defaults.title
  };
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function normalizeKind(value: string | null): ClientFavoriteKind | null {
  switch (value?.toLowerCase()) {
    case "tour":
    case "tours":
      return "tour";
    case "stay":
    case "stays":
    case "hotel":
    case "accommodation":
      return "stay";
    case "food":
    case "restaurant":
    case "dish":
      return "food";
    case "product":
    case "products":
    case "shop":
      return "product";
    default:
      return null;
  }
}

function favoriteDefaults(kind: ClientFavoriteKind, targetId: string) {
  const safeTargetId = encodeURIComponent(targetId);

  switch (kind) {
    case "tour":
      return { badge: "Тур", href: `/tours/${safeTargetId}`, title: "Сохранённый тур" };
    case "stay":
      return { badge: "Жильё", href: `/stays/${safeTargetId}`, title: "Сохранённое жильё" };
    case "food":
      return { badge: "Еда", href: `/food/${safeTargetId}`, title: "Сохранённое блюдо или ресторан" };
    case "product":
      return { badge: "Магазин", href: `/shop/${safeTargetId}`, title: "Сохранённый товар" };
  }
}
