import { requirePartner } from "@/lib/auth/roles";
import { getAuthenticatedRestConfig, getAuthenticatedRestHeaders } from "@/lib/data/authenticated-read-utils";
import type { Order, OrderStatus, OrderType, PaymentStatus } from "@/types";
import type { PartnerOrdersReadResult, SupabasePartnerOrderRow } from "@/lib/data/types";

const partnerOrderFields = [
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
  "updated_at"
].join(",");

function createSupabasePartnerOrdersResult(input: {
  ok: boolean;
  orders?: Order[];
  code?: PartnerOrdersReadResult["code"];
  message?: string;
}): PartnerOrdersReadResult {
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

function toOrderType(value: string): OrderType {
  return value === "shop" ? "shop" : "food";
}

function mapSupabaseOrder(row: SupabasePartnerOrderRow): Order {
  return {
    id: row.id,
    clientUserId: row.client_id,
    businessId: row.business_id,
    type: toOrderType(row.type),
    status: row.status as OrderStatus,
    items: [],
    subtotal: toNumber(row.subtotal),
    deliveryFee: toNumber(row.delivery_fee),
    total: toNumber(row.total),
    currency: "KGS",
    paymentStatus: row.payment_status as PaymentStatus,
    deliveryStatus: undefined,
    createdAt: row.created_at
  };
}

export async function getPartnerOrdersFromSupabase(): Promise<PartnerOrdersReadResult> {
  const [config, partner] = await Promise.all([getAuthenticatedRestConfig(), requirePartner()]);

  if (!config || !partner.ok || !partner.data.partnerId) {
    return createSupabasePartnerOrdersResult({
      ok: false,
      code: "supabase_not_configured",
      message: "Supabase read environment is not configured."
    });
  }

  try {
    const url = new URL(`${config.restUrl}/orders`);
    url.searchParams.set("business_id", `eq.${partner.data.partnerId}`);
    url.searchParams.set("select", partnerOrderFields);
    url.searchParams.set("order", "created_at.desc");

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: getAuthenticatedRestHeaders(config),
      cache: "no-store"
    });

    if (!response.ok) {
      return createSupabasePartnerOrdersResult({
        ok: false,
        code: "read_failed",
        message: "Partner orders could not be read safely."
      });
    }

    const rows = (await response.json()) as SupabasePartnerOrderRow[];
    const orders = rows.map(mapSupabaseOrder);

    if (orders.length === 0) {
      return createSupabasePartnerOrdersResult({
        ok: false,
        orders,
        code: "empty_result",
        message: "No Supabase partner orders were found for the authenticated business."
      });
    }

    return createSupabasePartnerOrdersResult({
      ok: true,
      orders,
      message: "Partner orders read from Supabase test data."
    });
  } catch {
    return createSupabasePartnerOrdersResult({
      ok: false,
      code: "server_error",
      message: "Partner orders read failed safely."
    });
  }
}
