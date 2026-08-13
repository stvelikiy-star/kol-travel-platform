import { getFood, getProducts, getStays, getTours } from "@/lib/data/catalog";
import { readClientFavoritesFromSupabase } from "@/lib/data/client-favorites-supabase";
import type { ClientFavoritesReadResult } from "@/lib/types/client-favorites";

export async function readClientFavorites(): Promise<ClientFavoritesReadResult> {
  if (process.env.DATA_SOURCE_MODE === "supabase") {
    return readClientFavoritesFromSupabase();
  }

  const tours = getTours();
  const stays = getStays();
  const foodItems = getFood();
  const products = getProducts();

  return {
    source: "mock",
    status: "ready",
    items: [
      ...tours.slice(0, 2).map((tour) => ({
        badge: tour.location,
        description: tour.description,
        href: `/tours/${tour.slug}`,
        id: `mock-tour-${tour.slug}`,
        kind: "tour" as const,
        meta: `${tour.price} ${tour.currency} · ${tour.duration}`,
        title: tour.title
      })),
      ...stays.slice(0, 2).map((stay) => ({
        badge: stay.location,
        description: stay.description,
        href: `/stays/${stay.slug}`,
        id: `mock-stay-${stay.slug}`,
        kind: "stay" as const,
        meta: `от ${stay.minPricePerNight} ${stay.currency} · рейтинг ${stay.rating}`,
        title: stay.title
      })),
      ...foodItems.slice(0, 1).map((food) => ({
        badge: food.category,
        description: food.description,
        href: "/food/naryn-beshbarmak",
        id: `mock-food-${food.title}`,
        kind: "food" as const,
        meta: `${food.price} ${food.currency}`,
        title: food.title
      })),
      ...products.slice(0, 1).map((product) => ({
        badge: product.category,
        description: product.description,
        href: "/shop/sary-oi-market",
        id: `mock-product-${product.title}`,
        kind: "product" as const,
        meta: `${product.price} ${product.currency}`,
        title: product.title
      }))
    ]
  };
}
