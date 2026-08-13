import { requireCourier } from "@/lib/auth/roles";
import { getAuthenticatedRestConfig, getAuthenticatedRestHeaders } from "@/lib/data/authenticated-read-utils";
import type {
  CourierDeliveriesReadResult,
  CourierDeliveryReadItem,
  SupabaseCourierDeliveryOrderRow
} from "@/lib/data/types";

const courierDeliveryFields = [
  "id",
  "client_id",
  "business_id",
  "type",
  "status",
  "payment_status",
  "total",
  "delivery_fee",
  "metadata",
  "created_at",
  "updated_at",
  "partners(title)"
].join(",");

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
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function mapCourierDelivery(row: SupabaseCourierDeliveryOrderRow): CourierDeliveryReadItem {
  return {
    id: `delivery-${row.id}`,
    orderId: row.id,
    clientId: row.client_id,
    businessId: row.business_id,
    partnerTitle: row.partners?.title ?? undefined,
    type: row.type,
    status: row.status,
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

  if (!courier.ok) {
    return createCourierDeliveriesSupabaseResult({
      ok: false,
      code: "read_failed",
      message: "Courier delivery data is not available for this authenticated role."
    });
  }

  try {
    const url = new URL(`${config.restUrl}/orders`);
    url.searchParams.set("select", courierDeliveryFields);
    url.searchParams.set("order", "updated_at.desc");

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: getAuthenticatedRestHeaders(config),
      cache: "no-store"
    });

    if (!response.ok) {
      return createCourierDeliveriesSupabaseResult({
        ok: false,
        code: "read_failed",
        message: "Courier deliveries could not be read safely."
      });
    }

    const rows = (await response.json()) as SupabaseCourierDeliveryOrderRow[];
    const deliveries = rows.map(mapCourierDelivery);

    if (deliveries.length === 0) {
      return createCourierDeliveriesSupabaseResult({
        ok: false,
        deliveries,
        code: "empty_result",
        message: "No Supabase courier deliveries were found."
      });
    }

    return createCourierDeliveriesSupabaseResult({
      ok: true,
      deliveries,
      message: "Courier deliveries read from Supabase test data."
    });
  } catch {
    return createCourierDeliveriesSupabaseResult({
      ok: false,
      code: "server_error",
      message: "Courier deliveries read failed safely."
    });
  }
}
