import {
  failedPartnerRead,
  getAuthenticatedPartnerReadContext,
  readAuthenticatedRows,
  type PartnerReadResult
} from "@/lib/data/authenticated-read-utils";
import type { PartnerBooking } from "@/lib/types/partner-bookings";
import type { BookingStatus } from "@/types";

const bookingStatuses = new Set<BookingStatus>([
  "pending",
  "confirmed",
  "checked_in",
  "completed",
  "cancelled",
  "rejected",
  "no_show"
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function mapBooking(row: unknown, businessId: string): PartnerBooking | null {
  if (!isRecord(row) || row.business_id !== businessId) {
    return null;
  }

  const endDate = row.end_date;
  const status = row.status;

  if (
    !nonEmptyString(row.id) ||
    !nonEmptyString(row.client_id) ||
    (row.type !== "stay" && row.type !== "tour") ||
    !nonEmptyString(row.title) ||
    !nonEmptyString(row.start_date) ||
    !(endDate === null || endDate === undefined || nonEmptyString(endDate)) ||
    !finiteNumber(row.guests) ||
    !Number.isInteger(row.guests) ||
    row.guests <= 0 ||
    !finiteNumber(row.total) ||
    row.total < 0 ||
    !nonEmptyString(row.currency) ||
    !nonEmptyString(row.payment_status) ||
    !nonEmptyString(status) ||
    !bookingStatuses.has(status as BookingStatus) ||
    !nonEmptyString(row.created_at)
  ) {
    return null;
  }

  return {
    id: row.id,
    businessId,
    clientUserId: row.client_id,
    type: row.type,
    title: row.title,
    startDate: row.start_date,
    ...(nonEmptyString(endDate) ? { endDate } : {}),
    guests: row.guests,
    total: row.total,
    currency: row.currency,
    paymentStatus: row.payment_status,
    status: status as BookingStatus,
    createdAt: row.created_at
  };
}

export async function readPartnerBookingsFromSupabase(): Promise<PartnerReadResult<PartnerBooking[]>> {
  const context = await getAuthenticatedPartnerReadContext();

  if (!context) {
    return failedPartnerRead();
  }

  const rows = await readAuthenticatedRows(context.rest, "bookings", {
    select: "id,business_id,client_id,type,title,start_date,end_date,guests,total,currency,payment_status,status,created_at",
    business_id: `eq.${context.businessId}`,
    order: "created_at.desc"
  });

  if (!rows) {
    return failedPartnerRead();
  }

  const bookings = rows.map((row) => mapBooking(row, context.businessId));

  if (
    bookings.some((booking) => booking === null) ||
    new Set(bookings.map((booking) => booking?.id)).size !== bookings.length
  ) {
    return failedPartnerRead();
  }

  return {
    ok: true,
    data: bookings as PartnerBooking[],
    source: "supabase"
  };
}
