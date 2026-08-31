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

const activeCourierAssignmentStatuses = new Set(["assigned", "accepted", "active"]);

type SupabaseCourierAssignmentRow = {
  delivery_id: string | null;
  courier_id: string | null;
  status: string | null;
};

type SupabaseCourierDeliveryRow = {
  id: string;
  order_id: string | null;
  status: string | null;
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
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function mapCourierDelivery(
  row: SupabaseCourierDeliveryOrderRow,
  deliveryId: string,
  deliveryStatus: string
): CourierDeliveryReadItem {
  return {
    id: deliveryId,
    orderId: row.id,
    clientId: row.client_id,
    businessId: row.business_id,
    partnerTitle: row.partners?.title ?? undefined,
    type: row.type,
    status: deliveryStatus,
    paymentStatus: row.payment_status,
    total: toNumber(row.total),
    deliveryFee: toNumber(row.delivery_fee),
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function createInFilter(values: string[]) {
  const quotedValues = values.map((value) => {
    const escapedValue = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `"${escapedValue}"`;
  });

  return `in.(${quotedValues.join(",")})`;
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
    const assignmentsUrl = new URL(`${config.restUrl}/courier_assignments`);
    assignmentsUrl.searchParams.set("select", "delivery_id,courier_id,status");
    assignmentsUrl.searchParams.set("courier_id", `eq.${config.userId}`);
    assignmentsUrl.searchParams.set("status", "in.(assigned,accepted,active)");

    const assignmentsResponse = await fetch(assignmentsUrl.toString(), {
      method: "GET",
      headers: getAuthenticatedRestHeaders(config),
      cache: "no-store"
    });

    if (!assignmentsResponse.ok) {
      return createCourierDeliveriesSupabaseResult({
        ok: false,
        code: "read_failed",
        message: "Courier assignments could not be read safely."
      });
    }

    const assignmentRows = (await assignmentsResponse.json()) as SupabaseCourierAssignmentRow[];
    const deliveryIds = Array.from(
      new Set(
        assignmentRows
          .filter((row) => row.courier_id === config.userId && activeCourierAssignmentStatuses.has(row.status ?? ""))
          .map((row) => row.delivery_id?.trim())
          .filter((deliveryId): deliveryId is string => Boolean(deliveryId))
      )
    );

    if (deliveryIds.length === 0) {
      return createCourierDeliveriesSupabaseResult({
        ok: false,
        code: "empty_result",
        message: "No active Supabase courier assignments were found for the authenticated courier."
      });
    }

    const deliveriesUrl = new URL(`${config.restUrl}/deliveries`);
    deliveriesUrl.searchParams.set("id", createInFilter(deliveryIds));
    deliveriesUrl.searchParams.set("select", "id,order_id,status");

    const deliveriesResponse = await fetch(deliveriesUrl.toString(), {
      method: "GET",
      headers: getAuthenticatedRestHeaders(config),
      cache: "no-store"
    });

    if (!deliveriesResponse.ok) {
      return createCourierDeliveriesSupabaseResult({
        ok: false,
        code: "read_failed",
        message: "Assigned courier deliveries could not be read safely."
      });
    }

    const deliveryRows = (await deliveriesResponse.json()) as SupabaseCourierDeliveryRow[];
    const assignedDeliveryIds = new Set(deliveryIds);
    const deliveryByOrderId = new Map<string, { id: string; status: string }>();

    for (const delivery of deliveryRows) {
      const orderId = delivery.order_id?.trim();
      const status = delivery.status?.trim();

      if (assignedDeliveryIds.has(delivery.id) && orderId && status) {
        deliveryByOrderId.set(orderId, { id: delivery.id, status });
      }
    }

    const orderIds = Array.from(deliveryByOrderId.keys());

    if (orderIds.length === 0) {
      return createCourierDeliveriesSupabaseResult({
        ok: false,
        code: "empty_result",
        message: "No orders were found for the authenticated courier assignments."
      });
    }

    const url = new URL(`${config.restUrl}/orders`);
    url.searchParams.set("id", createInFilter(orderIds));
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
    const deliveries = rows.flatMap((row) => {
      const delivery = deliveryByOrderId.get(row.id);
      return delivery ? [mapCourierDelivery(row, delivery.id, delivery.status)] : [];
    });

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
