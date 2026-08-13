import { isSupabaseMode } from "@/lib/data/data-source";
import { getAdminDeliveryOrdersFromSupabase } from "@/lib/data/admin-delivery-supabase";
import { getMockOrders } from "@/lib/data/mock-data-source";
import { getPartnerById } from "@/lib/data/partners";
import type { AdminDeliveryOrder, AdminDeliveryReadResult } from "@/lib/data/types";

function createMockAdminDeliveryOrders(): AdminDeliveryOrder[] {
  return getMockOrders().map((order) => {
    const partner = getPartnerById(order.businessId);

    return {
      id: order.id,
      clientId: order.clientUserId,
      businessId: order.businessId,
      partnerTitle: partner?.title,
      type: order.type,
      status: order.status,
      paymentStatus: order.paymentStatus,
      subtotal: order.subtotal,
      deliveryFee: order.deliveryFee,
      discount: 0,
      total: order.total,
      metadata: {},
      createdAt: order.createdAt,
      updatedAt: order.createdAt
    };
  });
}

function createMockAdminDeliveryReadResult(): AdminDeliveryReadResult {
  return {
    ok: true,
    source: "mock",
    orders: createMockAdminDeliveryOrders(),
    message: "Admin delivery orders read from mock data."
  };
}

export async function getAdminDeliveryReadResult(): Promise<AdminDeliveryReadResult> {
  if (!isSupabaseMode()) {
    return createMockAdminDeliveryReadResult();
  }

  return getAdminDeliveryOrdersFromSupabase();
}
