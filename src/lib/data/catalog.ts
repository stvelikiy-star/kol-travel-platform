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
    const supabaseTours = readToursFromSupabase();

    if (supabaseTours.length > 0) {
      return supabaseTours;
    }
  }

  return getMockTours();
}

export function getTourById(idOrSlug: string) {
  if (isSupabaseMode()) {
    const supabaseTour = readTourByIdFromSupabase(idOrSlug);

    if (supabaseTour) {
      return supabaseTour;
    }
  }

  return getTours().find((tour) => tour.id === idOrSlug || tour.slug === idOrSlug);
}

export function getTourSchedules() {
  return getMockTourSchedules();
}

export function getStays() {
  if (isSupabaseMode()) {
    const supabaseStays = readStaysFromSupabase();

    if (supabaseStays.length > 0) {
      return supabaseStays;
    }
  }

  return getMockStays();
}

export function getStayById(idOrSlug: string) {
  if (isSupabaseMode()) {
    const supabaseStay = readStayByIdFromSupabase(idOrSlug);

    if (supabaseStay) {
      return supabaseStay;
    }
  }

  return getStays().find((stay) => stay.id === idOrSlug || stay.slug === idOrSlug);
}

export function getRooms() {
  return getMockRooms();
}

export function getRoomAvailability() {
  return getMockRoomAvailability();
}

export function getFood() {
  if (isSupabaseMode()) {
    const supabaseFood = readFoodFromSupabase();

    if (supabaseFood.length > 0) {
      return supabaseFood;
    }
  }

  return getMockFood();
}

export function getFoodById(idOrSlug: string) {
  if (isSupabaseMode()) {
    const supabaseFood = readFoodByIdFromSupabase(idOrSlug);

    if (supabaseFood) {
      return supabaseFood;
    }
  }

  return getFood().find((food) => food.id === idOrSlug || food.title === idOrSlug);
}

export function getProducts() {
  if (isSupabaseMode()) {
    const supabaseProducts = readProductsFromSupabase();

    if (supabaseProducts.length > 0) {
      return supabaseProducts;
    }
  }

  return getMockProducts();
}

export function getProductById(idOrSlug: string) {
  if (isSupabaseMode()) {
    const supabaseProduct = readProductByIdFromSupabase(idOrSlug);

    if (supabaseProduct) {
      return supabaseProduct;
    }
  }

  return getProducts().find((product) => product.id === idOrSlug || product.title === idOrSlug);
}

// Future Supabase implementation should replace internals only, keeping this API stable.
