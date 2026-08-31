import type { AdminDeliveryOrder, AdminDeliveryReadResult } from "@/lib/data/types";

export type AdminOperationalDeliveryOrder = AdminDeliveryOrder & {
  deliveryId?: string;
  deliveryStatus?: string;
  assignedCourierId?: string;
};

export type AdminCourierOption = {
  userId: string;
  fullName?: string;
  email?: string;
  availabilityStatus: string;
  vehicleType?: string;
  vehicleNumber?: string;
  workingZone?: string;
};

export type AdminOperationalDeliveryReadResult = Omit<AdminDeliveryReadResult, "orders"> & {
  orders: AdminOperationalDeliveryOrder[];
  couriers: AdminCourierOption[];
  canAssignCourier: boolean;
};
