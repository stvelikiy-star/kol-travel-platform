import { requireAdmin } from "@/lib/auth/roles";
import type { AdminDeliveryOrder, AdminDeliveryReadResult, SupabaseAdminDeliveryOrderRow } from "@/lib/data/types";
import { getAuthenticatedRestConfig, getAuthenticatedRestHeaders } from "@/lib/data/authenticated-read-utils";

const adminDeliveryFields = [
  "id",
  "client_id",
  "business_id",
  "type",
  "status",
  "payment_status",
  "subtotal",
  "delivery_fee",
  "discount",
  "total",
  "metadata",
  "created_at",
  "updated_at",
  "partners(title)"
].join(",");

function createAdminDeliverySupabaseResult(input: {
  ok: boolean;
  orders?: AdminDeliveryOrder[];
  code?: AdminDeliveryReadResult["code"];
  message?: string;
}): AdminDeliveryReadResult {
  return {
    ok: input.ok,
    source: "supabase",
    orders: input.orders ?? [],
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

function mapAdminDeliveryOrder(row: SupabaseAdminDeliveryOrderRow): AdminDeliveryOrder {
  return {
    id: row.id,
    clientId: row.client_id,
    businessId: row.business_id,
    partnerTitle: row.partners?.title ?? undefined,
    type: row.type,
    status: row.status,
    paymentStatus: row.payment_status,
    subtotal: toNumber(row.subtotal),
    deliveryFee: toNumber(row.delivery_fee),
    discount: toNumber(row.discount),
    total: toNumber(row.total),
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function getAdminDeliveryOrdersFromSupabase(): Promise<AdminDeliveryReadResult> {
  const [config, admin] = await Promise.all([getAuthenticatedRestConfig(), requireAdmin()]);

  if (!config) {
    return createAdminDeliverySupabaseResult({
      ok: false,
      code: "supabase_not_configured",
      message: "Supabase read environment is not configured."
    });
  }

  if (!admin.ok) {
    return createAdminDeliverySupabaseResult({
      ok: false,
      code: "read_failed",
      message: "Admin delivery data is not available for this authenticated role."
    });
  }

  if (config.userId !== admin.data.userId) {
    return createAdminDeliverySupabaseResult({
      ok: false,
      code: "read_failed",
      message: "Admin delivery data is not available for this authenticated identity."
    });
  }

  try {
    const url = new URL(`${config.restUrl}/orders`);
    url.searchParams.set("select", adminDeliveryFields);
    url.searchParams.set("order", "updated_at.desc");

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: getAuthenticatedRestHeaders(config),
      cache: "no-store"
    });

    if (!response.ok) {
      return createAdminDeliverySupabaseResult({
        ok: false,
        code: "read_failed",
        message: "Admin delivery orders could not be read safely."
      });
    }

    const payload: unknown = await response.json();

    if (!Array.isArray(payload)) {
      return createAdminDeliverySupabaseResult({
        ok: false,
        code: "read_failed",
        message: "Admin delivery response was not valid."
      });
    }

    const rows = payload as SupabaseAdminDeliveryOrderRow[];
    const orders = rows.map(mapAdminDeliveryOrder);

    if (orders.length === 0) {
      return createAdminDeliverySupabaseResult({
        ok: false,
        orders,
        code: "empty_result",
        message: "No Supabase admin delivery orders were found."
      });
    }

    return createAdminDeliverySupabaseResult({
      ok: true,
      orders,
      message: "Admin delivery orders read from Supabase test data."
    });
  } catch {
    return createAdminDeliverySupabaseResult({
      ok: false,
      code: "server_error",
      message: "Admin delivery orders read failed safely."
    });
  }
}
