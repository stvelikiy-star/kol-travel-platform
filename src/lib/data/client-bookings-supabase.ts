import { requireClient } from "@/lib/auth/roles";
import { getAuthenticatedRestConfig, getAuthenticatedRestHeaders } from "@/lib/data/authenticated-read-utils";
import type { Booking, BookingStatus } from "@/types";

export type ClientBookingsReadCode = "supabase_not_configured" | "read_failed" | "empty_result" | "server_error";
export type ClientBookingsReadResult = {
  ok: boolean;
  source: "mock" | "supabase";
  bookings: Booking[];
  code?: ClientBookingsReadCode;
  message?: string;
};

const statuses = new Set<BookingStatus>([
  "pending",
  "confirmed",
  "checked_in",
  "completed",
  "cancelled",
  "rejected",
  "no_show"
]);

function result(input: {
  ok: boolean;
  bookings?: Booking[];
  code?: ClientBookingsReadCode;
  message?: string;
}): ClientBookingsReadResult {
  return { ok: input.ok, source: "supabase", bookings: input.bookings ?? [], code: input.code, message: input.message };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function safeId(value: unknown): value is string {
  return nonEmptyString(value) && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`));
}

type Reference = Omit<Booking, "title" | "currency"> & { objectId: string };

function mapReference(row: unknown, clientId: string): Reference | null {
  if (!isRecord(row) || row.client_id !== clientId) return null;
  const guests = toNumber(row.guests_count);
  const total = toNumber(row.total);
  const status = row.status;
  const endDate = row.end_date;

  if (
    !safeId(row.id) ||
    !safeId(row.business_id) ||
    (row.booking_type !== "stay" && row.booking_type !== "tour") ||
    !safeId(row.object_id) ||
    !nonEmptyString(status) ||
    !statuses.has(status as BookingStatus) ||
    !isDate(row.start_date) ||
    !(endDate === null || endDate === undefined || isDate(endDate)) ||
    guests === null || !Number.isInteger(guests) || guests <= 0 ||
    total === null || total < 0 ||
    !nonEmptyString(row.payment_status) ||
    !nonEmptyString(row.created_at)
  ) {
    return null;
  }

  return {
    id: row.id,
    clientUserId: clientId,
    businessId: row.business_id,
    type: row.booking_type,
    objectId: row.object_id,
    status: status as BookingStatus,
    startDate: row.start_date,
    ...(isDate(endDate) ? { endDate } : {}),
    guests,
    total,
    paymentStatus: row.payment_status as Booking["paymentStatus"],
    createdAt: row.created_at
  };
}

async function readTitles(
  restUrl: string,
  headers: Record<string, string>,
  table: "stays" | "tours",
  ids: string[]
): Promise<Map<string, { title: string; currency: "KGS" }>> {
  const mapped = new Map<string, { title: string; currency: "KGS" }>();
  if (ids.length === 0) return mapped;
  const url = new URL(`${restUrl}/${table}`);
  url.searchParams.set("id", `in.(${ids.join(",")})`);
  url.searchParams.set("select", "id,title,currency");
  const response = await fetch(url.toString(), { method: "GET", headers, cache: "no-store" });
  if (!response.ok) return mapped;
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) return mapped;
  for (const row of payload) {
    if (!isRecord(row) || !safeId(row.id) || !nonEmptyString(row.title) || row.currency !== "KGS") continue;
    mapped.set(row.id, { title: row.title, currency: "KGS" });
  }
  return mapped;
}

export async function getClientBookingsFromSupabase(): Promise<ClientBookingsReadResult> {
  try {
    const [config, client] = await Promise.all([getAuthenticatedRestConfig(), requireClient()]);
    if (!config) return result({ ok: false, code: "supabase_not_configured", message: "Supabase read environment is not configured." });
    if (!client.ok || config.userId !== client.data.userId || config.userId !== client.data.clientId) {
      return result({ ok: false, code: "read_failed", message: "Client bookings are not available for this authenticated identity." });
    }

    const clientId = client.data.clientId;
    const headers = getAuthenticatedRestHeaders(config);
    const url = new URL(`${config.restUrl}/bookings`);
    url.searchParams.set("client_id", `eq.${clientId}`);
    url.searchParams.set("select", "id,client_id,business_id,booking_type,object_id,status,start_date,end_date,guests_count,total,payment_status,created_at");
    url.searchParams.set("order", "created_at.desc");
    const response = await fetch(url.toString(), { method: "GET", headers, cache: "no-store" });
    if (!response.ok) return result({ ok: false, code: "read_failed", message: "Client bookings could not be read safely." });

    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) return result({ ok: false, code: "read_failed", message: "Client bookings response was invalid." });
    const references = payload.map((row) => mapReference(row, clientId));
    if (references.some((booking) => booking === null) || new Set(references.map((booking) => booking?.id)).size !== references.length) {
      return result({ ok: false, code: "read_failed", message: "Client bookings response was malformed or crossed the authenticated client boundary." });
    }

    const safeReferences = references as Reference[];
    const stayIds = safeReferences.filter((booking) => booking.type === "stay").map((booking) => booking.objectId);
    const tourIds = safeReferences.filter((booking) => booking.type === "tour").map((booking) => booking.objectId);
    const [stayTitles, tourTitles] = await Promise.all([
      readTitles(config.restUrl, headers, "stays", stayIds),
      readTitles(config.restUrl, headers, "tours", tourIds)
    ]);

    const bookings: Booking[] = safeReferences.map(({ objectId, ...booking }) => {
      const object = booking.type === "stay" ? stayTitles.get(objectId) : tourTitles.get(objectId);
      return {
        ...booking,
        title: object?.title ?? (booking.type === "stay" ? "Бронирование жилья" : "Бронирование тура"),
        currency: object?.currency ?? "KGS"
      };
    });

    if (bookings.length === 0) return result({ ok: false, bookings, code: "empty_result", message: "No client bookings were found." });
    return result({ ok: true, bookings, message: "Client bookings read from Supabase." });
  } catch {
    return result({ ok: false, code: "server_error", message: "Client bookings read failed safely." });
  }
}
