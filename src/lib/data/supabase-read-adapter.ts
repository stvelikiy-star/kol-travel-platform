import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Booking, FoodItem, Order, PartnerBusiness, Product, Stay, Tour } from "@/types";

export type SupabaseDeliveryDraft = {
  id: string;
  orderId: string;
  status: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  partnerName: string;
  pickupAddress: string;
  dropoffAddress: string;
  courierId: string;
};

export type SupabaseAdminDashboardDraft = {
  ordersCount: number;
  activeOrdersCount: number;
  bookingsCount: number;
  activeBookingsCount: number;
  partnersCount: number;
  deliveriesCount: number;
  highRiskDeliveriesCount: number;
};

function warnReadAdapter(message: string, error?: unknown) {
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[supabase-read-adapter] ${message}`, error instanceof Error ? error.message : "");
  }
}

function hasSafeSupabaseClient() {
  const client = getSupabaseServerClient();

  if (!client?.isConfigured) {
    return false;
  }

  return true;
}

function safeArrayRead<T>(label: string): T[] {
  try {
    if (!hasSafeSupabaseClient()) {
      warnReadAdapter(`${label}: Supabase client is not configured. Returning safe empty array.`);
      return [];
    }

    // TODO: Replace this placeholder with real typed Supabase SELECT queries after
    // DATA_SOURCE_MODE=supabase is enabled and RLS policies are tested.
    return [];
  } catch (error) {
    warnReadAdapter(`${label}: read failed. Returning safe empty array.`, error);
    return [];
  }
}

function safeNullableRead<T>(label: string): T | null {
  try {
    if (!hasSafeSupabaseClient()) {
      warnReadAdapter(`${label}: Supabase client is not configured. Returning null.`);
      return null;
    }

    // TODO: Replace this placeholder with a real single-row Supabase SELECT query.
    return null;
  } catch (error) {
    warnReadAdapter(`${label}: read failed. Returning null.`, error);
    return null;
  }
}

export function readOrdersFromSupabase(): Order[] {
  return safeArrayRead<Order>("orders");
}

export function readOrderByIdFromSupabase(id: string): Order | null {
  return safeNullableRead<Order>(`orders/${id}`);
}

export function readBookingsFromSupabase(): Booking[] {
  return safeArrayRead<Booking>("bookings");
}

export function readBookingByIdFromSupabase(id: string): Booking | null {
  return safeNullableRead<Booking>(`bookings/${id}`);
}

export function readToursFromSupabase(): Tour[] {
  return safeArrayRead<Tour>("tours");
}

export function readTourByIdFromSupabase(idOrSlug: string): Tour | null {
  return safeNullableRead<Tour>(`tours/${idOrSlug}`);
}

export function readStaysFromSupabase(): Stay[] {
  return safeArrayRead<Stay>("stays");
}

export function readStayByIdFromSupabase(idOrSlug: string): Stay | null {
  return safeNullableRead<Stay>(`stays/${idOrSlug}`);
}

export function readFoodFromSupabase(): FoodItem[] {
  return safeArrayRead<FoodItem>("menu_items");
}

export function readFoodByIdFromSupabase(idOrSlug: string): FoodItem | null {
  return safeNullableRead<FoodItem>(`menu_items/${idOrSlug}`);
}

export function readProductsFromSupabase(): Product[] {
  return safeArrayRead<Product>("products");
}

export function readProductByIdFromSupabase(idOrSlug: string): Product | null {
  return safeNullableRead<Product>(`products/${idOrSlug}`);
}

export function readPartnersFromSupabase(): PartnerBusiness[] {
  return safeArrayRead<PartnerBusiness>("partners");
}

export function readPartnerByIdFromSupabase(id: string): PartnerBusiness | null {
  return safeNullableRead<PartnerBusiness>(`partners/${id}`);
}

export function readDeliveriesFromSupabase(): SupabaseDeliveryDraft[] {
  return safeArrayRead<SupabaseDeliveryDraft>("deliveries");
}

export function readDeliveryByOrderIdFromSupabase(orderId: string): SupabaseDeliveryDraft | null {
  return safeNullableRead<SupabaseDeliveryDraft>(`deliveries/order/${orderId}`);
}

export function readAdminDashboardFromSupabase(): SupabaseAdminDashboardDraft | null {
  return safeNullableRead<SupabaseAdminDashboardDraft>("admin/dashboard");
}
