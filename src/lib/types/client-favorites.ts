export type ClientFavoriteKind = "tour" | "stay" | "food" | "product";

export interface ClientFavoriteItem {
  badge: string;
  description: string;
  href: string;
  id: string;
  kind: ClientFavoriteKind;
  meta: string;
  title: string;
}

export interface ClientFavoritesReadResult {
  items: ClientFavoriteItem[];
  source: "mock" | "supabase";
  status: "ready" | "unavailable";
}
