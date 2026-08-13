import { isSupabaseMode } from "@/lib/data/data-source";
import { getCourierDeliveriesFromSupabase } from "@/lib/data/courier-deliveries-supabase";
import { getMockOrders } from "@/lib/data/mock-data-source";
import { getPartnerById } from "@/lib/data/partners";
import type { CourierDeliveriesReadResult, CourierDeliveryReadItem } from "@/lib/data/types";

function createMockCourierDeliveries(): CourierDeliveryReadItem[] {
  return getMockOrders().map((order) => {
    const partner = getPartnerById(order.businessId);

    return {
      id: `delivery-${order.id}`,
      orderId: order.id,
      clientId: order.clientUserId,
      businessId: order.businessId,
      partnerTitle: partner?.title,
      type: order.type,
      status: order.deliveryStatus ?? order.status,
      paymentStatus: order.paymentStatus,
      total: order.total,
      deliveryFee: order.deliveryFee,
      metadata: {},
      createdAt: order.createdAt,
      updatedAt: order.createdAt
    };
  });
}

function createMockCourierDeliveriesReadResult(): CourierDeliveriesReadResult {
  return {
    ok: true,
    source: "mock",
    deliveries: createMockCourierDeliveries(),
    message: "Courier deliveries read from mock data."
  };
}

export async function getCourierDeliveriesReadResult(): Promise<CourierDeliveriesReadResult> {
  if (!isSupabaseMode()) {
    return createMockCourierDeliveriesReadResult();
  }

  return getCourierDeliveriesFromSupabase();
}
