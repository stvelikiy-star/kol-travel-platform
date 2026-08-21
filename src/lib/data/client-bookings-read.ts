import { isSupabaseMode } from "@/lib/data/data-source";
import { getMockBookings } from "@/lib/data/mock-data-source";
import { getClientBookingsFromSupabase, type ClientBookingsReadResult } from "@/lib/data/client-bookings-supabase";

export type { ClientBookingsReadResult } from "@/lib/data/client-bookings-supabase";

export async function getClientBookingsReadResult(): Promise<ClientBookingsReadResult> {
  if (!isSupabaseMode()) {
    return {
      ok: true,
      source: "mock",
      bookings: getMockBookings(),
      message: "Client bookings read from mock data."
    };
  }

  return getClientBookingsFromSupabase();
}
