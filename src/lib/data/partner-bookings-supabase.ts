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

type BookingReference = {
  id: string;
  businessId: string;
  clientUserId: string;
  type: "stay" | "tour";
  objectId: string;
  startDate: string;
  endDate?: string;
  guests: number;
  total: number;
  paymentStatus: string;
  status: BookingStatus;
  createdAt: string;
};

type OwnedBookingObject = {
  title: string;
  currency: string;
};

function safeReferenceId(value: unknown): value is string {
  return nonEmptyString(value) && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

function mapBookingReference(row: unknown, businessId: string): BookingReference | null {
  if (!isRecord(row) || row.business_id !== businessId) {
    return null;
  }

  const endDate = row.end_date;
  const status = row.status;

  if (
    !nonEmptyString(row.id) ||
    !nonEmptyString(row.client_id) ||
    (row.booking_type !== "stay" && row.booking_type !== "tour") ||
    !safeReferenceId(row.object_id) ||
    !nonEmptyString(row.start_date) ||
    !(endDate === null || endDate === undefined || nonEmptyString(endDate)) ||
    !finiteNumber(row.guests_count) ||
    !Number.isInteger(row.guests_count) ||
    row.guests_count <= 0 ||
    !finiteNumber(row.total) ||
    row.total < 0 ||
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
    type: row.booking_type,
    objectId: row.object_id,
    startDate: row.start_date,
    ...(nonEmptyString(endDate) ? { endDate } : {}),
    guests: row.guests_count,
    total: row.total,
    paymentStatus: row.payment_status,
    status: status as BookingStatus,
    createdAt: row.created_at
  };
}

function ownedIdsQuery(ids: string[]): string | null {
  if (ids.some((id) => !safeReferenceId(id))) {
    return null;
  }

  return `in.(${ids.join(",")})`;
}

function mapOwnedBookingObjects(
  rows: unknown[],
  businessId: string,
  expectedIds: Set<string>
): Map<string, OwnedBookingObject> | null {
  const objects = new Map<string, OwnedBookingObject>();

  for (const row of rows) {
    if (
      !isRecord(row) ||
      row.business_id !== businessId ||
      !safeReferenceId(row.id) ||
      !expectedIds.has(row.id) ||
      !nonEmptyString(row.title) ||
      !nonEmptyString(row.currency) ||
      objects.has(row.id)
    ) {
      return null;
    }

    objects.set(row.id, {
      title: row.title,
      currency: row.currency
    });
  }

  return objects.size === expectedIds.size ? objects : null;
}

export async function readPartnerBookingsFromSupabase(): Promise<PartnerReadResult<PartnerBooking[]>> {
  const context = await getAuthenticatedPartnerReadContext();

  if (!context) {
    return failedPartnerRead();
  }

  const rows = await readAuthenticatedRows(context.rest, "bookings", {
    select: "id,client_id,business_id,booking_type,object_id,status,start_date,end_date,guests_count,total,payment_status,created_at",
    business_id: `eq.${context.businessId}`,
    order: "created_at.desc"
  });

  if (!rows) {
    return failedPartnerRead();
  }

  const references = rows.map((row) => mapBookingReference(row, context.businessId));

  if (
    references.some((booking) => booking === null) ||
    new Set(references.map((booking) => booking?.id)).size !== references.length
  ) {
    return failedPartnerRead();
  }

  const safeReferences = references as BookingReference[];
  const stayIds = new Set(
    safeReferences.filter((booking) => booking.type === "stay").map((booking) => booking.objectId)
  );
  const tourIds = new Set(
    safeReferences.filter((booking) => booking.type === "tour").map((booking) => booking.objectId)
  );
  const stayFilter = ownedIdsQuery(Array.from(stayIds));
  const tourFilter = ownedIdsQuery(Array.from(tourIds));

  if (stayFilter === null || tourFilter === null) {
    return failedPartnerRead();
  }

  const ownershipFilter = `eq.${context.businessId}`;
  const [stayRows, tourRows] = await Promise.all([
    stayIds.size === 0
      ? Promise.resolve([])
      : readAuthenticatedRows(context.rest, "stays", {
          select: "id,business_id,title,currency",
          id: stayFilter,
          business_id: ownershipFilter
        }),
    tourIds.size === 0
      ? Promise.resolve([])
      : readAuthenticatedRows(context.rest, "tours", {
          select: "id,business_id,title,currency",
          id: tourFilter,
          business_id: ownershipFilter
        })
  ]);

  if (!stayRows || !tourRows) {
    return failedPartnerRead();
  }

  const staysById = mapOwnedBookingObjects(stayRows, context.businessId, stayIds);
  const toursById = mapOwnedBookingObjects(tourRows, context.businessId, tourIds);

  if (!staysById || !toursById) {
    return failedPartnerRead();
  }

  const bookings = safeReferences.map((booking): PartnerBooking | null => {
    const object = booking.type === "stay"
      ? staysById.get(booking.objectId)
      : toursById.get(booking.objectId);

    if (!object) {
      return null;
    }

    return {
      id: booking.id,
      businessId: booking.businessId,
      clientUserId: booking.clientUserId,
      type: booking.type,
      title: object.title,
      startDate: booking.startDate,
      ...(booking.endDate ? { endDate: booking.endDate } : {}),
      guests: booking.guests,
      total: booking.total,
      currency: object.currency,
      paymentStatus: booking.paymentStatus,
      status: booking.status,
      createdAt: booking.createdAt
    };
  });

  if (bookings.some((booking) => booking === null)) {
    return failedPartnerRead();
  }

  return {
    ok: true,
    data: bookings as PartnerBooking[],
    source: "supabase"
  };
}
