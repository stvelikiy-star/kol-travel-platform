import {
  getMockFood,
  getMockProducts,
  getMockRoomAvailability,
  getMockRooms,
  getMockStays,
  getMockTourSchedules,
  getMockTours
} from "@/lib/data/mock-data-source";
import { isSupabaseMode } from "@/lib/data/data-source";
import {
  readFoodByIdFromSupabase,
  readFoodFromSupabase,
  readProductByIdFromSupabase,
  readProductsFromSupabase,
  readStayByIdFromSupabase,
  readStaysFromSupabase,
  readTourByIdFromSupabase,
  readToursFromSupabase
} from "@/lib/data/supabase-read-adapter";

export function getTours() {
  if (isSupabaseMode()) {
    return readToursFromSupabase();
  }

  return getMockTours();
}

export function getTourById(idOrSlug: string) {
  if (isSupabaseMode()) {
    return readTourByIdFromSupabase(idOrSlug) ?? undefined;
  }

  return getTours().find((tour) => tour.id === idOrSlug || tour.slug === idOrSlug);
}

export function getTourSchedules() {
  if (isSupabaseMode()) {
    return [];
  }

  return getMockTourSchedules();
}

export function getStays() {
  if (isSupabaseMode()) {
    return readStaysFromSupabase();
  }

  return getMockStays();
}

export function getStayById(idOrSlug: string) {
  if (isSupabaseMode()) {
    return readStayByIdFromSupabase(idOrSlug) ?? undefined;
  }

  return getStays().find((stay) => stay.id === idOrSlug || stay.slug === idOrSlug);
}

export function getRooms() {
  if (isSupabaseMode()) {
    return [];
  }

  return getMockRooms();
}

export function getRoomAvailability() {
  if (isSupabaseMode()) {
    return [];
  }

  return getMockRoomAvailability();
}

export function getFood() {
  if (isSupabaseMode()) {
    return readFoodFromSupabase();
  }

  return getMockFood();
}

export function getFoodById(idOrSlug: string) {
  if (isSupabaseMode()) {
    return readFoodByIdFromSupabase(idOrSlug) ?? undefined;
  }

  return getFood().find((food) => food.id === idOrSlug || food.title === idOrSlug);
}

export function getProducts() {
  if (isSupabaseMode()) {
    return readProductsFromSupabase();
  }

  return getMockProducts();
}

export function getProductById(idOrSlug: string) {
  if (isSupabaseMode()) {
    return readProductByIdFromSupabase(idOrSlug) ?? undefined;
  }

  return getProducts().find((product) => product.id === idOrSlug || product.title === idOrSlug);
}

// Future Supabase implementation should replace internals only, keeping this API stable.
