import { getMockBookings } from "@/lib/data/mock-data-source";
import { isSupabaseMode } from "@/lib/data/data-source";
import { readBookingByIdFromSupabase, readBookingsFromSupabase } from "@/lib/data/supabase-read-adapter";

export function getBookings() {
  if (isSupabaseMode()) {
    return readBookingsFromSupabase();
  }

  return getMockBookings();
}

export function getBookingById(id: string) {
  if (isSupabaseMode()) {
    return readBookingByIdFromSupabase(id) ?? undefined;
  }

  return getBookings().find((booking) => booking.id === id);
}

export function getClientBookings(clientId?: string) {
  const bookings = getBookings();

  if (!clientId) {
    return bookings;
  }

  return bookings.filter((booking) => booking.clientUserId === clientId);
}

export function getPartnerBookings(partnerId?: string) {
  const bookings = getBookings();

  if (!partnerId) {
    return bookings;
  }

  return bookings.filter((booking) => booking.businessId === partnerId);
}

// Future Supabase implementation should replace internals only, keeping this API stable.
