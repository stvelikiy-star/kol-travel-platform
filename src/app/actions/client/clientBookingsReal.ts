"use server";

import { requireAuthenticatedUser } from "@/lib/auth/session";
import {
  createAtomicStayBookingFromSupabase,
  createAtomicTourBookingFromSupabase,
  type AtomicBookingWriteResult,
  type AtomicStayBookingInput,
  type AtomicTourBookingInput
} from "@/lib/data/booking-write-supabase";

function notAuthenticated(): AtomicBookingWriteResult {
  return {
    ok: false,
    code: "not_authenticated",
    message: "Authenticated client access is required."
  };
}

export async function createStayBookingRealAction(
  input: AtomicStayBookingInput
): Promise<AtomicBookingWriteResult> {
  const session = await requireAuthenticatedUser();
  if (!session.ok) return notAuthenticated();

  // Client identity and monetary values are deliberately absent from input.
  // PostgreSQL derives auth.uid(), room capacity, nightly price/overrides and total,
  // then locks/decrements availability and creates history in one transaction.
  return createAtomicStayBookingFromSupabase(input);
}

export async function createTourBookingRealAction(
  input: AtomicTourBookingInput
): Promise<AtomicBookingWriteResult> {
  const session = await requireAuthenticatedUser();
  if (!session.ok) return notAuthenticated();

  // Client identity and monetary values are deliberately absent from input.
  // PostgreSQL locks the schedule, validates capacity, derives the Tour price and
  // creates booking + initial history atomically.
  return createAtomicTourBookingFromSupabase(input);
}
