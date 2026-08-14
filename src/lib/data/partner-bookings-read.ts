import { getPartnerBookings } from "@/lib/data/bookings";
import { isSupabaseMode } from "@/lib/data/data-source";
import { readPartnerBookingsFromSupabase } from "@/lib/data/partner-bookings-supabase";
import type { PartnerReadResult } from "@/lib/data/authenticated-read-utils";
import type { PartnerBooking } from "@/lib/types/partner-bookings";

export async function getPartnerBookingsReadResult(): Promise<PartnerReadResult<PartnerBooking[]>> {
  if (isSupabaseMode()) {
    return readPartnerBookingsFromSupabase();
  }

  return {
    ok: true,
    data: getPartnerBookings() as PartnerBooking[],
    source: "mock"
  };
}

export async function getPartnerBookingReadResult(id: string): Promise<PartnerReadResult<PartnerBooking[]>> {
  const result = await getPartnerBookingsReadResult();

  if (!result.ok) {
    return result;
  }

  return {
    ...result,
    data: result.data.filter((booking) => booking.id === id)
  };
}
