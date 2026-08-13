import { getMockOrders } from "@/lib/data/mock-data-source";
import { isSupabaseMode } from "@/lib/data/data-source";
import { getPartnerOrdersFromSupabase } from "@/lib/data/partner-orders-supabase";
import type { PartnerOrdersReadResult } from "@/lib/data/types";

function getMockPartnerOrders(businessId?: string) {
  const orders = getMockOrders();

  if (!businessId) {
    return orders;
  }

  return orders.filter((order) => order.businessId === businessId);
}

function createMockPartnerOrdersResult(businessId?: string): PartnerOrdersReadResult {
  return {
    ok: true,
    source: "mock",
    orders: getMockPartnerOrders(businessId),
    message: "Partner orders read from mock data."
  };
}

export async function getPartnerOrdersReadResult(businessId?: string): Promise<PartnerOrdersReadResult> {
  if (!isSupabaseMode()) {
    return createMockPartnerOrdersResult(businessId);
  }

  return getPartnerOrdersFromSupabase();
}
