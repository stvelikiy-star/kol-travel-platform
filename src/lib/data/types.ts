import type { Order } from "@/types";

export type PartnerOrdersReadCode =
  | "supabase_not_configured"
  | "read_failed"
  | "empty_result"
  | "server_error";

export type PartnerOrdersReadSource = "mock" | "supabase";

export type PartnerOrdersReadResult = {
  ok: boolean;
  source: PartnerOrdersReadSource;
  orders: Order[];
  code?: PartnerOrdersReadCode;
  message?: string;
  fallbackUsed?: boolean;
};

export type SupabasePartnerOrderRow = {
  id: string;
  client_id: string;
  business_id: string;
  type: string;
  status: string;
  payment_status: string;
  subtotal: number | string | null;
  delivery_fee: number | string | null;
  discount: number | string | null;
  total: number | string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type AdminDeliveryReadCode =
  | "supabase_not_configured"
  | "read_failed"
  | "empty_result"
  | "server_error";

export type AdminDeliveryReadSource = "mock" | "supabase" | "fallback";

export type AdminDeliveryOrder = {
  id: string;
  clientId: string;
  businessId: string;
  partnerTitle?: string;
  type: string;
  status: string;
  paymentStatus: string;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type AdminDeliveryReadResult = {
  ok: boolean;
  source: AdminDeliveryReadSource;
  orders: AdminDeliveryOrder[];
  code?: AdminDeliveryReadCode;
  message?: string;
};

export type SupabaseAdminDeliveryOrderRow = {
  id: string;
  client_id: string;
  business_id: string;
  type: string;
  status: string;
  payment_status: string;
  subtotal: number | string | null;
  delivery_fee: number | string | null;
  discount: number | string | null;
  total: number | string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  partners?: {
    title?: string | null;
  } | null;
};

export type CourierDeliveriesReadCode =
  | "supabase_not_configured"
  | "read_failed"
  | "empty_result"
  | "server_error";

export type CourierDeliveriesReadSource = "mock" | "supabase" | "fallback";

export type CourierDeliveryReadItem = {
  id: string;
  orderId: string;
  clientId: string;
  businessId: string;
  partnerTitle?: string;
  type: string;
  status: string;
  paymentStatus: string;
  total: number;
  deliveryFee: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type CourierDeliveriesReadResult = {
  ok: boolean;
  source: CourierDeliveriesReadSource;
  deliveries: CourierDeliveryReadItem[];
  code?: CourierDeliveriesReadCode;
  message?: string;
};

export type SupabaseCourierDeliveryOrderRow = {
  id: string;
  client_id: string;
  business_id: string;
  type: string;
  status: string;
  payment_status: string;
  total: number | string | null;
  delivery_fee: number | string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  partners?: {
    title?: string | null;
  } | null;
};

export type ClientOrdersReadCode =
  | "supabase_not_configured"
  | "read_failed"
  | "empty_result"
  | "server_error";

export type ClientOrdersReadSource = "mock" | "supabase";

export type ClientOrderReadItem = {
  id: string;
  clientId: string;
  businessId: string;
  partnerTitle?: string;
  partnerSlug?: string;
  type: string;
  status: string;
  paymentStatus: string;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type ClientOrdersReadResult = {
  ok: boolean;
  source: ClientOrdersReadSource;
  orders: ClientOrderReadItem[];
  code?: ClientOrdersReadCode;
  message?: string;
};

export type SupabaseClientOrderRow = {
  id: string;
  client_id: string;
  business_id: string;
  type: string;
  status: string;
  payment_status: string;
  subtotal: number | string | null;
  delivery_fee: number | string | null;
  discount: number | string | null;
  total: number | string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  partners?: {
    title?: string | null;
    slug?: string | null;
  } | null;
};

export type PublicCatalogReadCode =
  | "supabase_not_configured"
  | "table_missing"
  | "read_failed"
  | "empty_result"
  | "server_error";

export type PublicCatalogReadSource = "mock" | "supabase" | "fallback";

export type PublicCatalogReadResult<TItem> = {
  ok: boolean;
  source: PublicCatalogReadSource;
  items: TItem[];
  code?: PublicCatalogReadCode;
  message?: string;
};

export type SupabasePublicFoodRow = {
  id: string;
  business_id: string;
  title: string;
  description: string | null;
  price: number | string | null;
  status: string;
  categories?: {
    title?: string | null;
  } | null;
  partners?: {
    title?: string | null;
    slug?: string | null;
  } | null;
};
