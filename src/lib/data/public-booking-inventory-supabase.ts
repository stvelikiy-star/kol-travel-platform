import type { AvailabilityStatus, Room, RoomAvailability, TourSchedule } from "@/types";

export type PublicBookingInventoryReadCode =
  | "supabase_not_configured"
  | "invalid_identifier"
  | "read_failed"
  | "invalid_response"
  | "server_error";

export type PublicStayInventoryReadResult = {
  ok: boolean;
  source: "supabase";
  rooms: Room[];
  availability: RoomAvailability[];
  code?: PublicBookingInventoryReadCode;
  message?: string;
};

export type PublicTourSchedulesReadResult = {
  ok: boolean;
  source: "supabase";
  schedules: TourSchedule[];
  code?: PublicBookingInventoryReadCode;
  message?: string;
};

type StayInventoryRpcRow = {
  room_id: string;
  stay_id: string;
  room_title: string;
  room_capacity: number | string;
  room_price_per_night: number | string;
  room_status: string;
  availability_date: string | null;
  availability_status: string | null;
  available_count: number | string | null;
  price_override: number | string | null;
};

type TourScheduleRpcRow = {
  schedule_id: string;
  tour_id: string;
  schedule_date: string;
  start_time: string | null;
  capacity: number | string;
  booked_count: number | string;
  remaining_count: number | string;
  schedule_status: string;
};

type RpcReadResult<T> = { ok: true; rows: T[] } | { ok: false };

const readTimeoutMs = 1500;
// PostgreSQL's uuid type accepts the full 128-bit UUID textual space. Do not
// incorrectly require RFC4122 version/variant bits here: recovered/demo rows
// use fixed, readable UUID values that are valid PostgreSQL uuid identifiers.
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getSupabaseReadConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY;

  if (!url || !publicKey) return null;

  return {
    rpcUrl: `${url.replace(/\/$/, "")}/rest/v1/rpc`,
    publicKey
  };
}

function toNumber(value: number | string | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toAvailabilityStatus(value: string): AvailabilityStatus | null {
  return value === "available" || value === "booked" || value === "blocked" ? value : null;
}

function getReadWindow() {
  const from = new Date();
  from.setUTCHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setUTCDate(to.getUTCDate() + 90);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

async function callPublicRpc<T>(
  config: NonNullable<ReturnType<typeof getSupabaseReadConfig>>,
  functionName: string,
  body: Record<string, string>
): Promise<RpcReadResult<T>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), readTimeoutMs);

  try {
    const response = await fetch(`${config.rpcUrl}/${functionName}`, {
      method: "POST",
      headers: {
        apikey: config.publicKey,
        accept: "application/json",
        "content-type": "application/json"
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal
    });

    if (!response.ok) return { ok: false };
    return { ok: true, rows: (await response.json()) as T[] };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(timeout);
  }
}

export async function getPublicStayInventoryFromSupabase(
  stayId: string
): Promise<PublicStayInventoryReadResult> {
  if (!uuidPattern.test(stayId)) {
    return { ok: false, source: "supabase", rooms: [], availability: [], code: "invalid_identifier", message: "Stay identifier is invalid." };
  }

  const config = getSupabaseReadConfig();
  if (!config) {
    return { ok: false, source: "supabase", rooms: [], availability: [], code: "supabase_not_configured", message: "Supabase read environment is not configured." };
  }

  try {
    const window = getReadWindow();
    const rpc = await callPublicRpc<StayInventoryRpcRow>(config, "get_public_stay_inventory", {
      p_stay_id: stayId,
      p_from: window.from,
      p_to: window.to
    });

    if (!rpc.ok) {
      return { ok: false, source: "supabase", rooms: [], availability: [], code: "read_failed", message: "Public Stay inventory RPC is unavailable or denied." };
    }

    const roomsById = new Map<string, Room>();
    const availability: RoomAvailability[] = [];

    for (const row of rpc.rows) {
      const capacity = toNumber(row.room_capacity);
      const basePrice = toNumber(row.room_price_per_night);

      if (!uuidPattern.test(row.room_id) || row.stay_id !== stayId || !row.room_title || capacity === null || !Number.isInteger(capacity) || capacity <= 0 || basePrice === null || basePrice < 0 || row.room_status !== "active") {
        return { ok: false, source: "supabase", rooms: [], availability: [], code: "invalid_response", message: "Public Stay inventory response failed validation." };
      }

      const existingRoom = roomsById.get(row.room_id);
      if (existingRoom && (existingRoom.title !== row.room_title || existingRoom.capacity !== capacity || existingRoom.pricePerNight !== basePrice)) {
        return { ok: false, source: "supabase", rooms: [], availability: [], code: "invalid_response", message: "Public Stay inventory contains inconsistent room rows." };
      }

      if (!existingRoom) {
        roomsById.set(row.room_id, {
          id: row.room_id,
          stayId,
          title: row.room_title,
          capacity,
          pricePerNight: basePrice,
          currency: "KGS",
          status: "active"
        });
      }

      if (row.availability_date !== null || row.availability_status !== null || row.available_count !== null || row.price_override !== null) {
        if (row.availability_date === null || row.availability_status === null || row.available_count === null) {
          return { ok: false, source: "supabase", rooms: [], availability: [], code: "invalid_response", message: "Public Stay availability contains a partial row." };
        }

        const status = toAvailabilityStatus(row.availability_status);
        const availableCount = toNumber(row.available_count);
        const overridePrice = toNumber(row.price_override);

        if (!status || availableCount === null || !Number.isInteger(availableCount) || availableCount < 0) {
          return { ok: false, source: "supabase", rooms: [], availability: [], code: "invalid_response", message: "Public Stay availability response failed validation." };
        }

        availability.push({
          id: `${row.room_id}:${row.availability_date}`,
          roomId: row.room_id,
          date: row.availability_date,
          status,
          pricePerNight: overridePrice ?? basePrice
        });
      }
    }

    if (new Set(availability.map((row) => row.id)).size !== availability.length) {
      return { ok: false, source: "supabase", rooms: [], availability: [], code: "invalid_response", message: "Public Stay availability contains duplicate room/date rows." };
    }

    return { ok: true, source: "supabase", rooms: Array.from(roomsById.values()), availability, message: "Public Stay booking inventory read through constrained RPC." };
  } catch {
    return { ok: false, source: "supabase", rooms: [], availability: [], code: "server_error", message: "Public Stay inventory read failed safely." };
  }
}

export async function getPublicTourSchedulesFromSupabase(
  tourId: string
): Promise<PublicTourSchedulesReadResult> {
  if (!uuidPattern.test(tourId)) {
    return { ok: false, source: "supabase", schedules: [], code: "invalid_identifier", message: "Tour identifier is invalid." };
  }

  const config = getSupabaseReadConfig();
  if (!config) {
    return { ok: false, source: "supabase", schedules: [], code: "supabase_not_configured", message: "Supabase read environment is not configured." };
  }

  try {
    const window = getReadWindow();
    const rpc = await callPublicRpc<TourScheduleRpcRow>(config, "get_public_tour_schedules", {
      p_tour_id: tourId,
      p_from: window.from,
      p_to: window.to
    });

    if (!rpc.ok) {
      return { ok: false, source: "supabase", schedules: [], code: "read_failed", message: "Public Tour schedules RPC is unavailable or denied." };
    }

    const schedules: TourSchedule[] = [];

    for (const row of rpc.rows) {
      const capacity = toNumber(row.capacity);
      const bookedCount = toNumber(row.booked_count);
      const remainingCount = toNumber(row.remaining_count);

      if (!uuidPattern.test(row.schedule_id) || row.tour_id !== tourId || !row.schedule_date || capacity === null || !Number.isInteger(capacity) || capacity <= 0 || bookedCount === null || !Number.isInteger(bookedCount) || bookedCount < 0 || remainingCount === null || !Number.isInteger(remainingCount) || remainingCount <= 0 || bookedCount >= capacity || row.schedule_status !== "available") {
        return { ok: false, source: "supabase", schedules: [], code: "invalid_response", message: "Public Tour schedules response failed validation." };
      }

      schedules.push({ id: row.schedule_id, tourId, date: row.schedule_date, startTime: row.start_time ?? "", capacity, bookedSeats: bookedCount, status: "available" });
    }

    if (new Set(schedules.map((row) => row.id)).size !== schedules.length) {
      return { ok: false, source: "supabase", schedules: [], code: "invalid_response", message: "Public Tour schedules contain duplicate IDs." };
    }

    return { ok: true, source: "supabase", schedules, message: "Public Tour schedules read through constrained RPC." };
  } catch {
    return { ok: false, source: "supabase", schedules: [], code: "server_error", message: "Public Tour schedules read failed safely." };
  }
}
