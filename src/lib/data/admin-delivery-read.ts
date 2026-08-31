import { isSupabaseMode } from "@/lib/data/data-source";
import { getAdminDeliveryOrdersFromSupabase } from "@/lib/data/admin-delivery-supabase";
import { getMockOrders } from "@/lib/data/mock-data-source";
import { getPartnerById } from "@/lib/data/partners";
import type {
  AdminOperationalDeliveryOrder,
  AdminOperationalDeliveryReadResult
} from "@/lib/data/admin-delivery-operational-types";

function createMockAdminDeliveryOrders(): AdminOperationalDeliveryOrder[] {
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

function createMockAdminDeliveryReadResult(): AdminOperationalDeliveryReadResult {
  return {
    ok: true,
    source: "mock",
    orders: createMockAdminDeliveryOrders(),
    couriers: [],
    message: "Admin delivery orders read from mock data. Operational mutations are unavailable outside Supabase mode."
  };
}

export async function getAdminDeliveryReadResult(): Promise<AdminOperationalDeliveryReadResult> {
  if (!isSupabaseMode()) {
    return createMockAdminDeliveryReadResult();
  }

  return getAdminDeliveryOrdersFromSupabase();
}
