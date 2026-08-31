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

type OwnedStayRoom = {
  stayId: string;
  title: string;
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

function mapOwnedStayRooms(
  rows: unknown[],
  businessId: string,
  expectedIds: Set<string>
): Map<string, OwnedStayRoom> | null {
  const rooms = new Map<string, OwnedStayRoom>();

  for (const row of rows) {
    if (
      !isRecord(row) ||
      row.business_id !== businessId ||
      !safeReferenceId(row.id) ||
      !expectedIds.has(row.id) ||
      !safeReferenceId(row.stay_id) ||
      !nonEmptyString(row.title) ||
      rooms.has(row.id)
    ) {
      return null;
    }

    rooms.set(row.id, {
      stayId: row.stay_id,
      title: row.title
    });
  }

  return rooms.size === expectedIds.size ? rooms : null;
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
  const stayRoomIds = new Set(
    safeReferences.filter((booking) => booking.type === "stay").map((booking) => booking.objectId)
  );
  const tourIds = new Set(
    safeReferences.filter((booking) => booking.type === "tour").map((booking) => booking.objectId)
  );
  const stayRoomFilter = ownedIdsQuery(Array.from(stayRoomIds));
  const tourFilter = ownedIdsQuery(Array.from(tourIds));

  if (stayRoomFilter === null || tourFilter === null) {
    return failedPartnerRead();
  }

  const ownershipFilter = `eq.${context.businessId}`;
  const [roomRows, tourRows] = await Promise.all([
    stayRoomIds.size === 0
      ? Promise.resolve([])
      : readAuthenticatedRows(context.rest, "rooms", {
          select: "id,stay_id,business_id,title",
          id: stayRoomFilter,
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

  if (!roomRows || !tourRows) {
    return failedPartnerRead();
  }

  const roomsById = mapOwnedStayRooms(roomRows, context.businessId, stayRoomIds);
  const toursById = mapOwnedBookingObjects(tourRows, context.businessId, tourIds);

  if (!roomsById || !toursById) {
    return failedPartnerRead();
  }

  const stayIds = new Set(Array.from(roomsById.values()).map((room) => room.stayId));
  const stayFilter = ownedIdsQuery(Array.from(stayIds));

  if (stayFilter === null) {
    return failedPartnerRead();
  }

  const stayRows = stayIds.size === 0
    ? []
    : await readAuthenticatedRows(context.rest, "stays", {
        select: "id,business_id,title,currency",
        id: stayFilter,
        business_id: ownershipFilter
      });

  if (!stayRows) {
    return failedPartnerRead();
  }

  const staysById = mapOwnedBookingObjects(stayRows, context.businessId, stayIds);

  if (!staysById) {
    return failedPartnerRead();
  }

  const bookings = safeReferences.map((booking): PartnerBooking | null => {
    if (booking.type === "stay") {
      const room = roomsById.get(booking.objectId);
      const stay = room ? staysById.get(room.stayId) : undefined;

      if (!room || !stay) {
        return null;
      }

      return {
        id: booking.id,
        businessId: booking.businessId,
        clientUserId: booking.clientUserId,
        type: booking.type,
        title: room.title,
        startDate: booking.startDate,
        ...(booking.endDate ? { endDate: booking.endDate } : {}),
        guests: booking.guests,
        total: booking.total,
        currency: stay.currency,
        paymentStatus: booking.paymentStatus,
        status: booking.status,
        createdAt: booking.createdAt
      };
    }

    const tour = toursById.get(booking.objectId);

    if (!tour) {
      return null;
    }

    return {
      id: booking.id,
      businessId: booking.businessId,
      clientUserId: booking.clientUserId,
      type: booking.type,
      title: tour.title,
      startDate: booking.startDate,
      ...(booking.endDate ? { endDate: booking.endDate } : {}),
      guests: booking.guests,
      total: booking.total,
      currency: tour.currency,
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
