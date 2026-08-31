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
      stays: getStays().map((stay) => ({
        id: stay.id,
        businessId: mockBusinessId,
        slug: stay.slug,
        title: stay.title,
        description: stay.description,
        type: stay.type,
        minPricePerNight: stay.minPricePerNight,
        currency: stay.currency,
        location: stay.location,
        status: stay.status
      })),
      rooms: getRooms().map((room) => ({ ...room, businessId: mockBusinessId })),
      roomAvailability: getRoomAvailability().map((availability) => ({
        id: `mock-room-availability-${availability.roomId}-${availability.date}`,
        roomId: availability.roomId,
        date: availability.date,
        availableCount: availability.status === "available" ? 1 : 0,
        priceOverride: null,
        pricePerNight: availability.pricePerNight,
        status: availability.status
      })),
      tours: getTours().map((tour) => ({
        id: tour.id,
        businessId: mockBusinessId,
        slug: tour.slug,
        title: tour.title,
        description: tour.description,
        price: tour.price,
        currency: tour.currency,
        duration: tour.duration,
        location: tour.location,
        status: tour.status
      })),
      tourSchedules: getTourSchedules().map((schedule) => ({
        id: `mock-tour-schedule-${schedule.tourId}-${schedule.date}-${schedule.startTime}`,
        tourId: schedule.tourId,
        date: schedule.date,
        time: schedule.startTime,
        capacity: schedule.capacity,
        bookedCount: schedule.bookedSeats,
        status: schedule.status
      }))
    },
    source: "mock"
  };
}
