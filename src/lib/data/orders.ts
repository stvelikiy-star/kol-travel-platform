import { getMockOrders } from "@/lib/data/mock-data-source";
import { isSupabaseMode } from "@/lib/data/data-source";
import { readOrderByIdFromSupabase, readOrdersFromSupabase } from "@/lib/data/supabase-read-adapter";

export function getOrders() {
  if (isSupabaseMode()) {
    return readOrdersFromSupabase();
  }

  return getMockOrders();
}

export function getOrderById(id: string) {
  if (isSupabaseMode()) {
    return readOrderByIdFromSupabase(id) ?? undefined;
  }

  return getOrders().find((order) => order.id === id);
}

export function getClientOrders(clientId?: string) {
  const orders = getOrders();

  if (!clientId) {
    return orders;
  }

  return orders.filter((order) => order.clientUserId === clientId);
}

export function getPartnerOrders(partnerId?: string) {
  const orders = getOrders();

  if (!partnerId) {
    return orders;
  }

  return orders.filter((order) => order.businessId === partnerId);
}

export function getDeliveryOrders() {
  return getOrders().filter((order) => order.deliveryStatus !== "cancelled");
}

// Future Supabase implementation should replace internals only, keeping this API stable.
