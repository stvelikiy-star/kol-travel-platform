import {
  failedPartnerRead,
  getAuthenticatedPartnerReadContext,
  readAuthenticatedRows,
  type PartnerReadResult
} from "@/lib/data/authenticated-read-utils";
import type {
  PartnerAvailabilityData,
  PartnerRoom,
  PartnerRoomAvailability,
  PartnerStay,
  PartnerTour,
  PartnerTourSchedule
} from "@/lib/types/partner-availability";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function mapStay(row: unknown, businessId: string): PartnerStay | null {
  if (
    !isRecord(row) ||
    row.business_id !== businessId ||
    !nonEmptyString(row.id) ||
    !nonEmptyString(row.slug) ||
    !nonEmptyString(row.title) ||
    !nonEmptyString(row.description) ||
    !nonEmptyString(row.type) ||
    !finiteNumber(row.price_from) ||
    row.price_from < 0 ||
    !nonEmptyString(row.currency) ||
    !nonEmptyString(row.location) ||
    !nonEmptyString(row.status)
  ) {
    return null;
  }

  return {
    id: row.id,
    businessId,
    slug: row.slug,
    title: row.title,
    description: row.description,
    type: row.type,
    minPricePerNight: row.price_from,
    currency: row.currency,
    location: row.location,
    status: row.status
  };
}

function mapRoom(row: unknown, businessId: string): PartnerRoom | null {
  if (
    !isRecord(row) ||
    row.business_id !== businessId ||
    !nonEmptyString(row.id) ||
    !nonEmptyString(row.stay_id) ||
    !nonEmptyString(row.title) ||
    !finiteNumber(row.price_per_night) ||
    row.price_per_night < 0 ||
    !finiteNumber(row.capacity) ||
    !Number.isInteger(row.capacity) ||
    row.capacity <= 0 ||
    !nonEmptyString(row.status)
  ) {
    return null;
  }

  return {
    id: row.id,
    businessId,
    stayId: row.stay_id,
    title: row.title,
    pricePerNight: row.price_per_night,
    capacity: row.capacity,
    status: row.status
  };
}

function mapTour(row: unknown, businessId: string): PartnerTour | null {
  if (
    !isRecord(row) ||
    row.business_id !== businessId ||
    !nonEmptyString(row.id) ||
    !nonEmptyString(row.slug) ||
    !nonEmptyString(row.title) ||
    !nonEmptyString(row.description) ||
    !finiteNumber(row.price) ||
    row.price < 0 ||
    !nonEmptyString(row.currency) ||
    !nonEmptyString(row.duration) ||
    !nonEmptyString(row.location) ||
    !nonEmptyString(row.status)
  ) {
    return null;
  }

  return {
    id: row.id,
    businessId,
    slug: row.slug,
    title: row.title,
    description: row.description,
    price: row.price,
    currency: row.currency,
    duration: row.duration,
    location: row.location,
    status: row.status
  };
}

function mapRoomAvailability(
  row: unknown,
  roomsById: Map<string, PartnerRoom>
): PartnerRoomAvailability | null {
  if (
    !isRecord(row) ||
    !nonEmptyString(row.room_id) ||
    !roomsById.has(row.room_id) ||
    !nonEmptyString(row.date) ||
    !finiteNumber(row.available_count) ||
    !Number.isInteger(row.available_count) ||
    row.available_count < 0 ||
    !(
      row.price_override === null ||
      (finiteNumber(row.price_override) && row.price_override >= 0)
    ) ||
    !nonEmptyString(row.status)
  ) {
    return null;
  }

  const room = roomsById.get(row.room_id);

  if (!room) {
    return null;
  }

  return {
    roomId: row.room_id,
    date: row.date,
    availableCount: row.available_count,
    priceOverride: row.price_override,
    pricePerNight: row.price_override ?? room.pricePerNight,
    status: row.status
  };
}

function mapTourSchedule(row: unknown, tourIds: Set<string>): PartnerTourSchedule | null {
  if (
    !isRecord(row) ||
    !nonEmptyString(row.tour_id) ||
    !tourIds.has(row.tour_id) ||
    !nonEmptyString(row.date) ||
    !nonEmptyString(row.time) ||
    !finiteNumber(row.capacity) ||
    !Number.isInteger(row.capacity) ||
    row.capacity < 0 ||
    !finiteNumber(row.booked_count) ||
    !Number.isInteger(row.booked_count) ||
    row.booked_count < 0 ||
    row.booked_count > row.capacity ||
    !nonEmptyString(row.status)
  ) {
    return null;
  }

  return {
    tourId: row.tour_id,
    date: row.date,
    time: row.time,
    capacity: row.capacity,
    bookedCount: row.booked_count,
    status: row.status
  };
}

function ownedIdsQuery(ids: string[]): string | null {
  if (ids.some((id) => !/^[A-Za-z0-9_-]+$/.test(id))) {
    return null;
  }

  return `in.(${ids.join(",")})`;
}

function hasUniqueIds(rows: Array<{ id: string }>): boolean {
  return new Set(rows.map((row) => row.id)).size === rows.length;
}

function hasUniqueRoomDates(rows: PartnerRoomAvailability[]): boolean {
  return new Set(rows.map((row) => `${row.roomId}\u0000${row.date}`)).size === rows.length;
}

function hasUniqueTourScheduleSlots(rows: PartnerTourSchedule[]): boolean {
  return new Set(rows.map((row) => `${row.tourId}\u0000${row.date}\u0000${row.time}`)).size === rows.length;
}

export async function readPartnerAvailabilityFromSupabase(): Promise<PartnerReadResult<PartnerAvailabilityData>> {
  const context = await getAuthenticatedPartnerReadContext();

  if (!context) {
    return failedPartnerRead();
  }

  const ownershipFilter = `eq.${context.businessId}`;
  const [stayRows, roomRows, tourRows] = await Promise.all([
    readAuthenticatedRows(context.rest, "stays", {
      select: "id,business_id,slug,title,description,type,price_from,currency,location,status",
      business_id: ownershipFilter,
      order: "title.asc"
    }),
    readAuthenticatedRows(context.rest, "rooms", {
      select: "id,business_id,stay_id,title,price_per_night,capacity,status",
      business_id: ownershipFilter,
      order: "title.asc"
    }),
    readAuthenticatedRows(context.rest, "tours", {
      select: "id,business_id,slug,title,description,price,currency,duration,location,status",
      business_id: ownershipFilter,
      order: "title.asc"
    })
  ]);

  if (!stayRows || !roomRows || !tourRows) {
    return failedPartnerRead();
  }

  const stays = stayRows.map((row) => mapStay(row, context.businessId));
  const rooms = roomRows.map((row) => mapRoom(row, context.businessId));
  const tours = tourRows.map((row) => mapTour(row, context.businessId));

  if ([...stays, ...rooms, ...tours].some((row) => row === null)) {
    return failedPartnerRead();
  }

  const safeStays = stays as PartnerStay[];
  const safeRooms = rooms as PartnerRoom[];
  const safeTours = tours as PartnerTour[];
  const stayIds = new Set(safeStays.map((stay) => stay.id));

  if (
    !hasUniqueIds(safeStays) ||
    !hasUniqueIds(safeRooms) ||
    !hasUniqueIds(safeTours) ||
    safeRooms.some((room) => !stayIds.has(room.stayId))
  ) {
    return failedPartnerRead();
  }

  const roomIds = new Set(safeRooms.map((room) => room.id));
  const roomsById = new Map(safeRooms.map((room) => [room.id, room]));
  const tourIds = new Set(safeTours.map((tour) => tour.id));
  const roomFilter = ownedIdsQuery(Array.from(roomIds));
  const tourFilter = ownedIdsQuery(Array.from(tourIds));

  if (roomFilter === null || tourFilter === null) {
    return failedPartnerRead();
  }

  const [availabilityRows, scheduleRows] = await Promise.all([
    roomIds.size === 0
      ? Promise.resolve([])
      : readAuthenticatedRows(context.rest, "room_availability", {
          select: "room_id,date,status,available_count,price_override",
          room_id: roomFilter,
          order: "date.asc"
        }),
    tourIds.size === 0
      ? Promise.resolve([])
      : readAuthenticatedRows(context.rest, "tour_schedules", {
          select: "tour_id,date,time,capacity,booked_count,status",
          tour_id: tourFilter,
          order: "date.asc,time.asc"
        })
  ]);

  if (!availabilityRows || !scheduleRows) {
    return failedPartnerRead();
  }

  const roomAvailability = availabilityRows.map((row) => mapRoomAvailability(row, roomsById));
  const tourSchedules = scheduleRows.map((row) => mapTourSchedule(row, tourIds));

  if (
    [...roomAvailability, ...tourSchedules].some((row) => row === null) ||
    !hasUniqueRoomDates(roomAvailability as PartnerRoomAvailability[]) ||
    !hasUniqueTourScheduleSlots(tourSchedules as PartnerTourSchedule[])
  ) {
    return failedPartnerRead();
  }

  return {
    ok: true,
    data: {
      stays: safeStays,
      rooms: safeRooms,
      roomAvailability: roomAvailability as PartnerRoomAvailability[],
      tours: safeTours,
      tourSchedules: tourSchedules as PartnerTourSchedule[]
    },
    source: "supabase"
  };
}
