import { isSupabaseMode } from "@/lib/data/data-source";
import {
  getMockRoomAvailability,
  getMockRooms,
  getMockStays,
  getMockTourSchedules,
  getMockTours
} from "@/lib/data/mock-data-source";
import {
  getPublicStayInventoryFromSupabase,
  getPublicTourSchedulesFromSupabase,
  type PublicBookingInventoryReadCode
} from "@/lib/data/public-booking-inventory-supabase";
import { getPublicStaysFromSupabase } from "@/lib/data/public-stays-supabase";
import { getPublicToursFromSupabase } from "@/lib/data/public-tours-supabase";
import type { Room, RoomAvailability, Stay, Tour, TourSchedule } from "@/types";

export type PublicBookingDetailReadCode =
  | PublicBookingInventoryReadCode
  | "not_found"
  | "catalog_read_failed";

export type PublicStayDetailReadResult = {
  ok: boolean;
  source: "mock" | "supabase";
  stay?: Stay;
  rooms: Room[];
  availability: RoomAvailability[];
  similarStays: Stay[];
  inventoryOk: boolean;
  code?: PublicBookingDetailReadCode;
  message?: string;
};

export type PublicTourDetailReadResult = {
  ok: boolean;
  source: "mock" | "supabase";
  tour?: Tour;
  schedules: TourSchedule[];
  similarTours: Tour[];
  inventoryOk: boolean;
  code?: PublicBookingDetailReadCode;
  message?: string;
};

function getMockStayDetail(slug: string): PublicStayDetailReadResult {
  const stays = getMockStays();
  const stay = stays.find((item) => item.slug === slug || item.id === slug);

  if (!stay) {
    return {
      ok: false,
      source: "mock",
      rooms: [],
      availability: [],
      similarStays: [],
      inventoryOk: false,
      code: "not_found",
      message: "Stay was not found in mock development data."
    };
  }

  const rooms = getMockRooms().filter((room) => room.stayId === stay.id);
  const roomIds = new Set(rooms.map((room) => room.id));

  return {
    ok: true,
    source: "mock",
    stay,
    rooms,
    availability: getMockRoomAvailability().filter((item) => roomIds.has(item.roomId)),
    similarStays: stays.filter((item) => item.id !== stay.id).slice(0, 3),
    inventoryOk: true
  };
}

function getMockTourDetail(slug: string): PublicTourDetailReadResult {
  const tours = getMockTours();
  const tour = tours.find((item) => item.slug === slug || item.id === slug);

  if (!tour) {
    return {
      ok: false,
      source: "mock",
      schedules: [],
      similarTours: [],
      inventoryOk: false,
      code: "not_found",
      message: "Tour was not found in mock development data."
    };
  }

  return {
    ok: true,
    source: "mock",
    tour,
    schedules: getMockTourSchedules().filter((schedule) => schedule.tourId === tour.id),
    similarTours: tours.filter((item) => item.id !== tour.id).slice(0, 3),
    inventoryOk: true
  };
}

export async function getPublicStayDetailReadResult(
  slug: string
): Promise<PublicStayDetailReadResult> {
  if (!isSupabaseMode()) return getMockStayDetail(slug);

  const catalog = await getPublicStaysFromSupabase();
  if (!catalog.ok) {
    return {
      ok: false,
      source: "supabase",
      rooms: [],
      availability: [],
      similarStays: [],
      inventoryOk: false,
      code: "catalog_read_failed",
      message: catalog.message ?? "Public Stay catalog read failed safely."
    };
  }

  const stay = catalog.items.find((item) => item.slug === slug || item.id === slug);
  if (!stay) {
    return {
      ok: false,
      source: "supabase",
      rooms: [],
      availability: [],
      similarStays: catalog.items.slice(0, 3),
      inventoryOk: false,
      code: "not_found",
      message: "Stay was not found in the public Supabase catalog."
    };
  }

  const inventory = await getPublicStayInventoryFromSupabase(stay.id);

  return {
    ok: true,
    source: "supabase",
    stay,
    rooms: inventory.rooms,
    availability: inventory.availability,
    similarStays: catalog.items.filter((item) => item.id !== stay.id).slice(0, 3),
    inventoryOk: inventory.ok,
    code: inventory.ok ? undefined : inventory.code,
    message: inventory.ok ? undefined : inventory.message
  };
}

export async function getPublicTourDetailReadResult(
  slug: string
): Promise<PublicTourDetailReadResult> {
  if (!isSupabaseMode()) return getMockTourDetail(slug);

  const catalog = await getPublicToursFromSupabase();
  if (!catalog.ok) {
    return {
      ok: false,
      source: "supabase",
      schedules: [],
      similarTours: [],
      inventoryOk: false,
      code: "catalog_read_failed",
      message: catalog.message ?? "Public Tour catalog read failed safely."
    };
  }

  const tour = catalog.items.find((item) => item.slug === slug || item.id === slug);
  if (!tour) {
    return {
      ok: false,
      source: "supabase",
      schedules: [],
      similarTours: catalog.items.slice(0, 3),
      inventoryOk: false,
      code: "not_found",
      message: "Tour was not found in the public Supabase catalog."
    };
  }

  const inventory = await getPublicTourSchedulesFromSupabase(tour.id);

  return {
    ok: true,
    source: "supabase",
    tour,
    schedules: inventory.schedules,
    similarTours: catalog.items.filter((item) => item.id !== tour.id).slice(0, 3),
    inventoryOk: inventory.ok,
    code: inventory.ok ? undefined : inventory.code,
    message: inventory.ok ? undefined : inventory.message
  };
}
