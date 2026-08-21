"use server";

import { requireClient } from "@/lib/auth/roles";
import {
  createAtomicStayBookingFromSupabase,
  createAtomicTourBookingFromSupabase,
  type AtomicBookingWriteResult,
  type AtomicStayBookingInput,
  type AtomicTourBookingInput
} from "@/lib/data/booking-write-supabase";

function notAuthorized(): AtomicBookingWriteResult {
  return {
    ok: false,
    code: "not_authorized",
    message: "Active client access is required."
  };
}

export async function createStayBookingRealAction(
  input: AtomicStayBookingInput
): Promise<AtomicBookingWriteResult> {
  const client = await requireClient();
  if (!client.ok) return notAuthorized();

  // Client identity and monetary values are deliberately absent from input.
  // PostgreSQL derives auth.uid(), room capacity, nightly price/overrides and total,
  // then locks/decrements availability and creates history in one transaction.
  return createAtomicStayBookingFromSupabase(input);
}

export async function createTourBookingRealAction(
  input: AtomicTourBookingInput
): Promise<AtomicBookingWriteResult> {
  const client = await requireClient();
  if (!client.ok) return notAuthorized();

  // Client identity and monetary values are deliberately absent from input.
  // PostgreSQL locks the schedule, validates capacity, derives the Tour price and
  // creates booking + initial history atomically.
  return createAtomicTourBookingFromSupabase(input);
}
