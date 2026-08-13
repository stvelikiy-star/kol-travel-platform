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

function createMockCourierDeliveriesReadResult(
  source: CourierDeliveriesReadResult["source"] = "mock"
): CourierDeliveriesReadResult {
  return {
    ok: true,
    source,
    deliveries: createMockCourierDeliveries(),
    message: source === "fallback"
      ? "Supabase courier deliveries read failed. Returned mock fallback."
      : "Courier deliveries read from mock data."
  };
}

export async function getCourierDeliveriesReadResult(): Promise<CourierDeliveriesReadResult> {
  if (!isSupabaseMode()) {
    return createMockCourierDeliveriesReadResult();
  }

  const supabaseResult = await getCourierDeliveriesFromSupabase();

  if (supabaseResult.ok) {
    return supabaseResult;
  }

  const fallback = createMockCourierDeliveriesReadResult("fallback");

  return {
    ...fallback,
    code: supabaseResult.code,
    message: supabaseResult.message ?? fallback.message
  };
}
