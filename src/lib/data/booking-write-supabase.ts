import {
  getAuthenticatedRestConfig,
  getAuthenticatedRestHeaders
} from "@/lib/data/authenticated-read-utils";

export type AtomicStayBookingInput = {
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
  return value.length >= 8 && value.length <= 128 && value.trim() === value;
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

export async function createAtomicStayBookingFromSupabase(
  input: AtomicStayBookingInput
): Promise<AtomicBookingWriteResult> {
  if (!isUuid(input.roomId)) return fail("invalid_room_id", "Invalid room id.");
  if (!isIsoDate(input.startDate) || !isIsoDate(input.endDate) || input.endDate <= input.startDate) {
    return fail("invalid_dates", "Stay dates are invalid.");
  }
  if (!Number.isInteger(input.guestsCount) || input.guestsCount < 1 || input.guestsCount > 50) {
    return fail("invalid_guests_count", "Guest count is invalid.");
  }
  if (!isValidIdempotencyKey(input.idempotencyKey)) {
    return fail("invalid_idempotency_key", "Invalid idempotency key.");
  }

  const config = await getAuthenticatedRestConfig();
  if (!config) return fail("supabase_not_configured", "Supabase booking write is not configured.");

  try {
    const response = await fetch(`${config.restUrl}/rpc/create_stay_booking_atomic`, {
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
        p_guests_count: input.guestsCount,
        p_idempotency_key: input.idempotencyKey
      })
    });

    const bookingId = await parseRpcUuid(response);
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
  if (!Number.isInteger(input.participants) || input.participants < 1 || input.participants > 50) {
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
