import type { BookingStatus } from "@/types";

export type PartnerBooking = {
  id: string;
  businessId: string;
  clientUserId: string;
  type: "stay" | "tour";
  title: string;
  startDate: string;
  endDate?: string;
  guests: number;
  total: number;
  currency: string;
  paymentStatus: string;
  status: BookingStatus;
  createdAt: string;
};
