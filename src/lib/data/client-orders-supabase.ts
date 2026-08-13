import { requireClient } from "@/lib/auth/roles";
import { getAuthenticatedRestConfig, getAuthenticatedRestHeaders } from "@/lib/data/authenticated-read-utils";
import type { ClientOrderReadItem, ClientOrdersReadResult, SupabaseClientOrderRow } from "@/lib/data/types";

const clientOrderFields = [
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
  "partners(title,slug)"
].join(",");

function createClientOrdersSupabaseResult(input: {
  ok: boolean;
  orders?: ClientOrderReadItem[];
  code?: ClientOrdersReadResult["code"];
  message?: string;
}): ClientOrdersReadResult {
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

function mapClientOrder(row: SupabaseClientOrderRow): ClientOrderReadItem {
  return {
    id: row.id,
    clientId: row.client_id,
    businessId: row.business_id,
    partnerTitle: row.partners?.title ?? undefined,
    partnerSlug: row.partners?.slug ?? undefined,
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

export async function getClientOrdersFromSupabase(): Promise<ClientOrdersReadResult> {
  const [config, client] = await Promise.all([getAuthenticatedRestConfig(), requireClient()]);

  if (!config) {
    return createClientOrdersSupabaseResult({
      ok: false,
      code: "supabase_not_configured",
      message: "Supabase read environment is not configured."
    });
  }

  if (!client.ok) {
    return createClientOrdersSupabaseResult({
      ok: false,
      code: "read_failed",
      message: "Client orders are not available for this authenticated role."
    });
  }

  try {
    const url = new URL(`${config.restUrl}/orders`);
    url.searchParams.set("client_id", `eq.${config.userId}`);
    url.searchParams.set("select", clientOrderFields);
    url.searchParams.set("order", "created_at.desc");

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: getAuthenticatedRestHeaders(config),
      cache: "no-store"
    });

    if (!response.ok) {
      return createClientOrdersSupabaseResult({
        ok: false,
        code: "read_failed",
        message: "Client orders could not be read safely."
      });
    }

    const rows = (await response.json()) as SupabaseClientOrderRow[];
    const orders = rows.map(mapClientOrder);

    if (orders.length === 0) {
      return createClientOrdersSupabaseResult({
        ok: false,
        orders,
        code: "empty_result",
        message: "No Supabase client orders were found for the authenticated client."
      });
    }

    return createClientOrdersSupabaseResult({
      ok: true,
      orders,
      message: "Client orders read from Supabase test data."
    });
  } catch {
    return createClientOrdersSupabaseResult({
      ok: false,
      code: "server_error",
      message: "Client orders read failed safely."
    });
  }
}
