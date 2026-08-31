import { requireCourier } from "@/lib/auth/roles";
import { getAuthenticatedRestConfig, getAuthenticatedRestHeaders } from "@/lib/data/authenticated-read-utils";
import type { CourierDeliveriesReadResult, CourierDeliveryReadItem } from "@/lib/data/types";

type CourierActiveDeliveryRpcRow = {
  delivery_id: string;
  order_id: string;
  client_id: string;
  business_id: string;
  type: string;
  delivery_status: string;
  payment_status: string;
  total: number | string | null;
  delivery_fee: number | string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  partner_title: string | null;
};

function createCourierDeliveriesSupabaseResult(input: {
  ok: boolean;
  deliveries?: CourierDeliveryReadItem[];
  code?: CourierDeliveriesReadResult["code"];
  message?: string;
}): CourierDeliveriesReadResult {
  return {
    ok: input.ok,
    source: "supabase",
    deliveries: input.deliveries ?? [],
    code: input.code,
    message: input.message
  };
}

function toNumber(value: number | string | null | undefined) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function isRpcRow(value: unknown): value is CourierActiveDeliveryRpcRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return ["delivery_id", "order_id", "client_id", "business_id", "type", "delivery_status", "payment_status", "created_at", "updated_at"]
    .every((key) => typeof row[key] === "string" && row[key].length > 0);
}

function mapCourierDelivery(row: CourierActiveDeliveryRpcRow): CourierDeliveryReadItem {
  return {
    id: row.delivery_id,
    orderId: row.order_id,
    clientId: row.client_id,
    businessId: row.business_id,
    partnerTitle: row.partner_title ?? undefined,
    type: row.type,
    status: row.delivery_status,
    paymentStatus: row.payment_status,
    total: toNumber(row.total),
    deliveryFee: toNumber(row.delivery_fee),
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function getCourierDeliveriesFromSupabase(): Promise<CourierDeliveriesReadResult> {
  const [config, courier] = await Promise.all([getAuthenticatedRestConfig(), requireCourier()]);

  if (!config) {
    return createCourierDeliveriesSupabaseResult({
      ok: false,
      code: "supabase_not_configured",
      message: "Supabase read environment is not configured."
    });
  }

  if (!courier.ok || courier.data.userId !== config.userId) {
    return createCourierDeliveriesSupabaseResult({
      ok: false,
      code: "read_failed",
      message: "Courier delivery data is not available for this authenticated role."
    });
  }

  try {
    const response = await fetch(`${config.restUrl}/rpc/get_courier_active_deliveries`, {
      method: "POST",
      headers: {
        ...getAuthenticatedRestHeaders(config),
        "content-type": "application/json"
      },
      body: "{}",
      cache: "no-store"
    });

    if (!response.ok) {
      return createCourierDeliveriesSupabaseResult({
        ok: false,
        code: "read_failed",
        message: "Assigned courier deliveries could not be read safely."
      });
    }

    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) {
      return createCourierDeliveriesSupabaseResult({
        ok: false,
        code: "read_failed",
        message: "Courier delivery response was not valid."
      });
    }

    const deliveries = payload.filter(isRpcRow).map(mapCourierDelivery);
    if (deliveries.length !== payload.length) {
      return createCourierDeliveriesSupabaseResult({
        ok: false,
        code: "read_failed",
        message: "Courier delivery response contained an invalid row."
      });
    }

    if (deliveries.length === 0) {
      return createCourierDeliveriesSupabaseResult({
        ok: false,
        deliveries,
        code: "empty_result",
        message: "No active Supabase courier assignments were found for the authenticated courier."
      });
    }

    return createCourierDeliveriesSupabaseResult({
      ok: true,
      deliveries,
      message: "Courier active deliveries read from the scoped Supabase RPC."
    });
  } catch {
    return createCourierDeliveriesSupabaseResult({
      ok: false,
      code: "server_error",
      message: "Courier deliveries read failed safely."
    });
  }
}
