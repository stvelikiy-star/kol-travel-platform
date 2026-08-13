import type { Booking } from "@/types";

export const mockBookings: Booking[] = [
  {
    id: "booking-stay-pending",
    clientUserId: "client-001",
    businessId: "business-guest-bosteri",
    type: "stay",
    targetId: "room-001",
    title: "Семейная комната, Бостери Үй",
    status: "pending",
    startDate: "2026-07-01",
    endDate: "2026-07-04",
    guests: 4,
    total: 12600,
    currency: "KGS",
    paymentStatus: "pending",
    createdAt: "2026-06-18T11:00:00+06:00"
  },
  {
    id: "booking-tour-confirmed",
    clientUserId: "client-002",
    businessId: "business-guide-bishkek",
    type: "tour",
    targetId: "tour-boat-cholpon-ata",
    title: "Прогулка на катере по Иссык-Кулю",
    status: "confirmed",
    startDate: "2026-07-01",
    guests: 2,
    total: 5000,
    currency: "KGS",
    paymentStatus: "pending",
    createdAt: "2026-06-18T12:15:00+06:00"
  },
  {
    id: "booking-stay-completed",
    clientUserId: "client-003",
    businessId: "business-hotel-aurora",
    type: "stay",
    targetId: "room-002",
    title: "Стандарт с видом на озеро",
    status: "completed",
    startDate: "2026-06-10",
    endDate: "2026-06-12",
    guests: 2,
    total: 12400,
    currency: "KGS",
    paymentStatus: "paid",
    createdAt: "2026-06-01T13:40:00+06:00"
  },
  {
    id: "booking-tour-cancelled",
    clientUserId: "client-004",
    businessId: "business-tour-karakol",
    type: "tour",
    targetId: "tour-hot-springs-karakol",
    title: "Горячие источники Каракола",
    status: "cancelled",
    startDate: "2026-06-20",
    guests: 3,
    total: 12600,
    currency: "KGS",
    paymentStatus: "refunded",
    createdAt: "2026-06-05T10:25:00+06:00"
  }
];
