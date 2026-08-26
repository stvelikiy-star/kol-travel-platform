import { requireAdmin } from "@/lib/auth/roles";
import { getAuthenticatedRestConfig, getAuthenticatedRestHeaders } from "@/lib/data/authenticated-read-utils";
import type { Booking, BookingStatus, PaymentStatus } from "@/types";

export type AdminBookingsReadCode = "supabase_not_configured" | "read_failed" | "empty_result" | "server_error";
export type AdminBookingsReadResult = {
  ok: boolean;
  source: "mock" | "supabase";
  bookings: Booking[];
  code?: AdminBookingsReadCode;
  message?: string;
};

const bookingStatuses = new Set<BookingStatus>(["pending", "confirmed", "checked_in", "completed", "cancelled", "rejected", "no_show"]);
const paymentStatuses = new Set<PaymentStatus>(["pending", "paid", "failed", "refunded", "cancelled"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function text(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
function safeId(value: unknown): value is string {
  return text(value) && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}
function numberValue(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
function dateValue(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`));
}

function makeResult(input: Omit<AdminBookingsReadResult, "source" | "bookings"> & { bookings?: Booking[] }): AdminBookingsReadResult {
  return { ...input, source: "supabase", bookings: input.bookings ?? [] };
}

type BookingReference = Omit<Booking, "title" | "currency"> & { objectId: string };

function mapReference(row: unknown): BookingReference | null {
  if (!isRecord(row)) return null;
  const guests = numberValue(row.guests_count);
  const total = numberValue(row.total);
  const status = row.status;
  const paymentStatus = row.payment_status;
  const endDate = row.end_date;
  if (
    !safeId(row.id) || !safeId(row.client_id) || !safeId(row.business_id) || !safeId(row.object_id) ||
    (row.booking_type !== "stay" && row.booking_type !== "tour") ||
    !text(status) || !bookingStatuses.has(status as BookingStatus) ||
    !text(paymentStatus) || !paymentStatuses.has(paymentStatus as PaymentStatus) ||
    !dateValue(row.start_date) || !(endDate == null || dateValue(endDate)) ||
    guests === null || !Number.isInteger(guests) || guests <= 0 || total === null || total < 0 || !text(row.created_at)
  ) return null;

  return {
    id: row.id,
    clientUserId: row.client_id,
    businessId: row.business_id,
    type: row.booking_type,
    targetId: row.object_id,
    objectId: row.object_id,
    status: status as BookingStatus,
    startDate: row.start_date,
    ...(dateValue(endDate) ? { endDate } : {}),
    guests,
    total,
    paymentStatus: paymentStatus as PaymentStatus,
    createdAt: row.created_at
  };
}

async function readObjectTitles(restUrl: string, headers: Record<string, string>, table: "rooms" | "tours", ids: string[]) {
  const result = new Map<string, string>();
  if (!ids.length) return result;
  const url = new URL(`${restUrl}/${table}`);
  url.searchParams.set("id", `in.(${ids.join(",")})`);
  url.searchParams.set("select", "id,title");
  const response = await fetch(url.toString(), { method: "GET", headers, cache: "no-store" });
  if (!response.ok) return result;
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) return result;
  for (const row of payload) {
    if (isRecord(row) && safeId(row.id) && text(row.title)) result.set(row.id, row.title);
  }
  return result;
}

export async function getAdminBookingsFromSupabase(): Promise<AdminBookingsReadResult> {
  try {
    const [config, admin] = await Promise.all([getAuthenticatedRestConfig(), requireAdmin()]);
    if (!config) return makeResult({ ok: false, code: "supabase_not_configured", message: "Supabase read environment is not configured." });
    if (!admin.ok || config.userId !== admin.data.userId) return makeResult({ ok: false, code: "read_failed", message: "Admin bookings are not available for this authenticated identity." });

    const headers = getAuthenticatedRestHeaders(config);
    const url = new URL(`${config.restUrl}/bookings`);
    url.searchParams.set("select", "id,client_id,business_id,booking_type,object_id,status,start_date,end_date,guests_count,total,payment_status,created_at");
    url.searchParams.set("order", "created_at.desc");
    const response = await fetch(url.toString(), { method: "GET", headers, cache: "no-store" });
    if (!response.ok) return makeResult({ ok: false, code: "read_failed", message: "Admin bookings could not be read safely." });
    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) return makeResult({ ok: false, code: "read_failed", message: "Admin bookings response was invalid." });
    const refs = payload.map(mapReference);
    if (refs.some((item) => item === null)) return makeResult({ ok: false, code: "read_failed", message: "Admin bookings response contained malformed data." });
    const safeRefs = refs as BookingReference[];
    const roomIds = safeRefs.filter((item) => item.type === "stay").map((item) => item.objectId);
    const tourIds = safeRefs.filter((item) => item.type === "tour").map((item) => item.objectId);
    const [roomTitles, tourTitles] = await Promise.all([
      readObjectTitles(config.restUrl, headers, "rooms", roomIds),
      readObjectTitles(config.restUrl, headers, "tours", tourIds)
    ]);
    const bookings = safeRefs.map(({ objectId, ...booking }): Booking => ({
      ...booking,
      title: (booking.type === "stay" ? roomTitles.get(objectId) : tourTitles.get(objectId)) ?? (booking.type === "stay" ? "Бронирование жилья" : "Бронирование тура"),
      currency: "KGS"
    }));
    if (!bookings.length) return makeResult({ ok: false, bookings, code: "empty_result", message: "No admin bookings were found." });
    return makeResult({ ok: true, bookings, message: "Admin bookings read from Supabase." });
  } catch {
    return makeResult({ ok: false, code: "server_error", message: "Admin bookings read failed safely." });
  }
}
