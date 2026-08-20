import type { Order } from "@/types";
import { isSupabaseMode } from "@/lib/data/data-source";
import { getDeliveryOrders, getOrderById } from "@/lib/data/orders";
import { getPartnerById } from "@/lib/data/partners";
import { readDeliveriesFromSupabase, readDeliveryByOrderIdFromSupabase } from "@/lib/data/supabase-read-adapter";

export type DeliveryStatus =
  | "delivery_pending"
  | "courier_assigned"
  | "courier_accepted"
  | "courier_to_partner"
  | "arrived_at_partner"
  | "picked_up"
  | "courier_to_client"
  | "arrived_at_client"
  | "delivered"
  | "delivery_failed";

export type DeliveryRiskLevel = "low" | "medium" | "high" | "critical";

export type DemoDelivery = {
  id: string;
  orderId: string;
  status: DeliveryStatus;
  riskLevel: DeliveryRiskLevel;
  partnerName: string;
  pickupAddress: string;
  dropoffAddress: string;
  courierId: string;
};

export const courierDeliveryProgression: ReadonlyArray<DeliveryStatus> = [
  "courier_assigned",
  "courier_accepted",
  "courier_to_partner",
  "arrived_at_partner",
  "picked_up",
  "courier_to_client",
  "arrived_at_client",
  "delivered"
];

export function getDeliveries(): DemoDelivery[] {
  if (isSupabaseMode()) {
    return readDeliveriesFromSupabase().map((delivery) => ({
      ...delivery,
      status: normalizeSupabaseDeliveryStatus(delivery.status)
    }));
  }

  return getDeliveryOrders().map((order) => {
    const partner = getPartnerById(order.businessId);

    return {
      id: `delivery-${order.id}`,
      orderId: order.id,
      status: normalizeDeliveryStatus(order.deliveryStatus),
      riskLevel: getDeliveryRiskLevel(order),
      partnerName: partner?.title ?? "KOL Partner",
      pickupAddress: partner?.location ?? "Issyk-Kul pickup point",
      dropoffAddress: "Demo client address",
      courierId: "demo-courier"
    };
  });
}

export function getDeliveryByOrderId(orderId: string) {
  if (isSupabaseMode()) {
    const supabaseDelivery = readDeliveryByOrderIdFromSupabase(orderId);

    return supabaseDelivery
      ? {
          ...supabaseDelivery,
          status: normalizeSupabaseDeliveryStatus(supabaseDelivery.status)
        }
      : undefined;
  }

  return getDeliveries().find((delivery) => delivery.orderId === orderId);
}

export function getCourierDeliveries(courierId?: string) {
  const deliveries = getDeliveries();

  if (!courierId) {
    return deliveries;
  }

  return deliveries.filter((delivery) => delivery.courierId === courierId);
}

export function getDeliveryRiskLevel(order: Order): DeliveryRiskLevel {
  if (order.status === "cancelled" || order.deliveryStatus === "cancelled") {
    return "high";
  }

  if (order.status === "preparing" || order.status === "assembling") {
    return "medium";
  }

  return "low";
}

function normalizeDeliveryStatus(status: Order["deliveryStatus"]): DeliveryStatus {
  switch (status) {
    case "assigned":
      return "courier_assigned";
    case "picked_up":
      return "picked_up";
    case "delivering":
      return "courier_to_client";
    case "delivered":
      return "delivered";
    case "cancelled":
      return "delivery_failed";
    case "pending":
    default:
      return "delivery_pending";
  }
}

function normalizeSupabaseDeliveryStatus(status: string): DeliveryStatus {
  switch (status) {
    case "courier_assigned":
    case "courier_accepted":
    case "courier_to_partner":
    case "arrived_at_partner":
    case "picked_up":
    case "courier_to_client":
    case "arrived_at_client":
    case "delivered":
    case "delivery_failed":
      return status;
    case "cancelled":
      return "delivery_failed";
    case "delivery_pending":
    case "courier_searching":
    default:
      return "delivery_pending";
  }
}

export function getDeliveryOrderById(orderId: string) {
  return getOrderById(orderId);
}

// Future Supabase implementation should replace internals only, keeping this API stable.
