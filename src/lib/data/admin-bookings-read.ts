import { isSupabaseMode } from "@/lib/data/data-source";
import { getMockBookings } from "@/lib/data/mock-data-source";
import { getAdminBookingsFromSupabase, type AdminBookingsReadResult } from "@/lib/data/admin-bookings-supabase";

export type { AdminBookingsReadResult } from "@/lib/data/admin-bookings-supabase";

export async function getAdminBookingsReadResult(): Promise<AdminBookingsReadResult> {
  if (!isSupabaseMode()) {
    return {
      ok: true,
      source: "mock",
      bookings: getMockBookings(),
      message: "Admin bookings read from mock data."
    };
  }
  return getAdminBookingsFromSupabase();
}
