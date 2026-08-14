import { getRoomAvailability, getRooms, getStays, getTourSchedules, getTours } from "@/lib/data/catalog";
import { isSupabaseMode } from "@/lib/data/data-source";
import type { PartnerReadResult } from "@/lib/data/authenticated-read-utils";
import { readPartnerAvailabilityFromSupabase } from "@/lib/data/partner-availability-supabase";
import type { PartnerAvailabilityData } from "@/lib/types/partner-availability";

export async function getPartnerAvailabilityReadResult(): Promise<PartnerReadResult<PartnerAvailabilityData>> {
  if (isSupabaseMode()) {
    return readPartnerAvailabilityFromSupabase();
  }

  const mockBusinessId = "mock-partner";

  return {
    ok: true,
    data: {
      stays: getStays().map((stay) => ({ ...stay, businessId: mockBusinessId })),
      rooms: getRooms().map((room) => ({ ...room, businessId: mockBusinessId })),
      roomAvailability: getRoomAvailability(),
      tours: getTours().map((tour) => ({ ...tour, businessId: mockBusinessId })),
      tourSchedules: getTourSchedules()
    },
    source: "mock"
  };
}
