import { isSupabaseMode } from "@/lib/data/data-source";
import { getClientOrdersFromSupabase } from "@/lib/data/client-orders-supabase";
import { getMockOrders } from "@/lib/data/mock-data-source";
import { getPartnerById } from "@/lib/data/partners";
import type { ClientOrderReadItem, ClientOrdersReadResult } from "@/lib/data/types";

function createMockClientOrders(clientId?: string): ClientOrderReadItem[] {
  const orders = clientId
    ? getMockOrders().filter((order) => order.clientUserId === clientId)
    : getMockOrders();

  return orders.map((order) => {
    const partner = getPartnerById(order.businessId);

    return {
      id: order.id,
      clientId: order.clientUserId,
      businessId: order.businessId,
      partnerTitle: partner?.title,
      partnerSlug: partner?.slug,
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

function createMockClientOrdersReadResult(clientId?: string): ClientOrdersReadResult {
  return {
    ok: true,
    source: "mock",
    orders: createMockClientOrders(clientId),
    message: "Client orders read from mock data."
  };
}

export async function getClientOrdersReadResult(clientId?: string): Promise<ClientOrdersReadResult> {
  if (!isSupabaseMode()) {
    return createMockClientOrdersReadResult(clientId);
  }

  return getClientOrdersFromSupabase();
}
