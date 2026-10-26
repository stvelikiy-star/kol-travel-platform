import {
  getAuthenticatedRestConfig,
  getAuthenticatedRestHeaders
} from "@/lib/data/authenticated-read-utils";

export type AtomicStayBookingInput = {
  stayId: string;
  roomId: string;
  startDate: string;
  endDate: string;
  guestsCount: number;
  idempotencyKey: string;
};

export type AtomicTourBookingInput = {
  tourScheduleId: string;
  participants: number;
  idempotencyKey: string;
};

export type AtomicBookingWriteResult = {
  ok: boolean;
  bookingId?: string;
  code?: string;
  message: string;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function fail(code: string, message: string): AtomicBookingWriteResult {
  return { ok: false, code, message };
}

function isUuid(value: string) {
  return uuidPattern.test(value);
}

function isIsoDate(value: string) {
  if (!datePattern.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value;
}

function isValidIdempotencyKey(value: string) {
  return value.trim().length >= 8 && value.length <= 128;
}

// The active KÖL staging database already exposes this established JSONB RPC.
// Preserve its audited reservation/idempotency contract instead of calling the
// later, unapplied create_stay_booking_atomic draft.
async function parseExistingStayBookingResult(response: Response): Promise<string | null> {
  if (!response.ok) return null;
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const data = payload as Record<string, unknown>;
  return data.ok === true && typeof data.booking_id === "string" && isUuid(data.booking_id)
    ? data.booking_id
    : null;
}

async function parseRpcUuid(response: Response): Promise<string | null> {
  if (!response.ok) return null;
  const payload: unknown = await response.json();
  return typeof payload === "string" && isUuid(payload) ? payload : null;
}

function mapRpcFailure(responseStatus: number): AtomicBookingWriteResult {
  if (responseStatus === 401 || responseStatus === 403) {
    return fail("not_authorized", "Authenticated booking access is required.");
  }

  if (responseStatus === 400 || responseStatus === 409 || responseStatus === 422) {
    return fail("booking_rejected", "Booking could not be created with the selected availability.");
  }

  return fail("booking_rpc_failed", "Booking could not be created safely.");
}

// Use the public, constrained SECURITY DEFINER projection. Direct reading of
// room_availability as the client is correctly denied by the existing RLS.
// This intentionally fails closed until migration 006e is installed and verified.
async function allStayNightsConfirmed(
  config: NonNullable<Awaited<ReturnType<typeof getAuthenticatedRestConfig>>>,
  input: AtomicStayBookingInput
): Promise<boolean> {
  const start = Date.parse(`${input.startDate}T00:00:00Z`);
  const end = Date.parse(`${input.endDate}T00:00:00Z`);
  const nights = (end - start) / 86400000;
  if (!Number.isInteger(nights) || nights < 1 || nights > 60 ||
      input.startDate < new Date().toISOString().slice(0, 10)) return false;

  try {
    const response = await fetch(`${config.restUrl}/rpc/get_public_stay_inventory`, {
      method: "POST",
      headers: { ...getAuthenticatedRestHeaders(config), "content-type": "application/json" },
      body: JSON.stringify({ p_stay_id: input.stayId, p_from: input.startDate, p_to: input.endDate }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) return false;
    const rows: unknown = await response.json();
    if (!Array.isArray(rows)) return false;
    const confirmed = new Set<string>();
    for (const row of rows) {
      if (!row || typeof row !== "object" || Array.isArray(row)) return false;
      const slot = row as Record<string, unknown>;
      // A mismatched room or stay must not approve the user's selected room.
      if (slot.room_id !== input.roomId || slot.stay_id !== input.stayId ||
          typeof slot.availability_date !== "string") continue;
      const count = Number(slot.available_count);
      if (slot.availability_status !== "available" ||
          !Number.isInteger(count) || count < 1 || confirmed.has(slot.availability_date)) return false;
      confirmed.add(slot.availability_date);
    }
    if (confirmed.size !== nights) return false;
    for (let i = 0; i < nights; i++) {
      if (!confirmed.has(new Date(start + i * 86400000).toISOString().slice(0, 10))) return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function createAtomicStayBookingFromSupabase(
  input: AtomicStayBookingInput
): Promise<AtomicBookingWriteResult> {
  if (!isUuid(input.stayId)) return fail("invalid_stay_id", "Invalid stay id.");
  if (!isUuid(input.roomId)) return fail("invalid_room_id", "Invalid room id.");
  if (!isIsoDate(input.startDate) || !isIsoDate(input.endDate) || input.endDate <= input.startDate) {
    return fail("invalid_dates", "Stay dates are invalid.");
  }
  if (!Number.isInteger(input.guestsCount) || input.guestsCount < 1) {
    return fail("invalid_guests_count", "Guest count is invalid.");
  }
  if (!isValidIdempotencyKey(input.idempotencyKey)) {
    return fail("invalid_idempotency_key", "Invalid idempotency key.");
  }

  const config = await getAuthenticatedRestConfig();
  if (!config) return fail("supabase_not_configured", "Supabase booking write is not configured.");
  if (!await allStayNightsConfirmed(config, input)) {
    return fail("booking_rejected", "No confirmed availability for all selected nights.");
  }

  try {
    const response = await fetch(`${config.restUrl}/rpc/client_stay_booking_create_atomic`, {
      method: "POST",
      headers: {
        ...getAuthenticatedRestHeaders(config),
        "content-type": "application/json"
      },
      cache: "no-store",
      body: JSON.stringify({
        p_room_id: input.roomId,
        p_start_date: input.startDate,
        p_end_date: input.endDate,
        p_guests: input.guestsCount,
        p_request_id: input.idempotencyKey
      })
    });

    const bookingId = await parseExistingStayBookingResult(response);
    if (!bookingId) return mapRpcFailure(response.status);

    return {
      ok: true,
      bookingId,
      message: "Stay booking created through the atomic database transaction."
    };
  } catch {
    return fail("server_error", "Booking could not be created safely.");
  }
}

export async function createAtomicTourBookingFromSupabase(
  input: AtomicTourBookingInput
): Promise<AtomicBookingWriteResult> {
  if (!isUuid(input.tourScheduleId)) {
    return fail("invalid_tour_schedule_id", "Invalid tour schedule id.");
  }
  if (!Number.isInteger(input.participants) || input.participants < 1) {
    return fail("invalid_participants", "Participant count is invalid.");
  }
  if (!isValidIdempotencyKey(input.idempotencyKey)) {
    return fail("invalid_idempotency_key", "Invalid idempotency key.");
  }

  const config = await getAuthenticatedRestConfig();
  if (!config) return fail("supabase_not_configured", "Supabase booking write is not configured.");

  try {
    const response = await fetch(`${config.restUrl}/rpc/create_tour_booking_atomic`, {
      method: "POST",
      headers: {
        ...getAuthenticatedRestHeaders(config),
        "content-type": "application/json"
      },
      cache: "no-store",
      body: JSON.stringify({
        p_tour_schedule_id: input.tourScheduleId,
        p_participants: input.participants,
        p_idempotency_key: input.idempotencyKey
      })
    });

    const bookingId = await parseRpcUuid(response);
    if (!bookingId) return mapRpcFailure(response.status);

    return {
      ok: true,
      bookingId,
      message: "Tour booking created through the atomic database transaction."
    };
  } catch {
    return fail("server_error", "Booking could not be created safely.");
  }
}
