import { requirePartner } from "@/lib/auth/roles";
import { getAuthenticatedRestConfig, getAuthenticatedRestHeaders } from "@/lib/data/authenticated-read-utils";
import type { Order, OrderItem, OrderStatus, OrderType, PaymentStatus } from "@/types";
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

const partnerOrderItemFields = [
  "id",
  "order_id",
  "item_type",
  "item_id",
  "title_snapshot",
  "qty",
  "unit_price",
  "total"
].join(",");

type SupabasePartnerOrderItemRow = {
  id: string;
  order_id: string;
  item_type: string;
  item_id: string | null;
  title_snapshot: string;
  qty: number | string | null;
  unit_price: number | string | null;
  total: number | string | null;
};

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
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }
  return Number.NaN;
}

function toOrderType(value: string): OrderType | null {
  return value === "food" || value === "shop" ? value : null;
}

function toItemType(value: string): OrderItem["itemType"] | null {
  if (value === "menu_item" || value === "food") return "food";
  if (value === "product") return "product";
  return null;
}

function mapOrderItem(row: SupabasePartnerOrderItemRow): OrderItem {
  const itemType = toItemType(row.item_type);
  const quantity = toNumber(row.qty);
  const unitPrice = toNumber(row.unit_price);
  const totalPrice = toNumber(row.total);

  if (!itemType || !row.item_id || !Number.isInteger(quantity) || quantity < 1 || !Number.isFinite(unitPrice) || !Number.isFinite(totalPrice)) {
    throw new Error("Invalid partner order item payload.");
  }

  return {
    id: row.id,
    orderId: row.order_id,
    itemType,
    itemId: row.item_id,
    title: row.title_snapshot,
    quantity,
    unitPrice,
    totalPrice
  };
}

function mapSupabaseOrder(row: SupabasePartnerOrderRow, items: OrderItem[]): Order {
  const type = toOrderType(row.type);
  const subtotal = toNumber(row.subtotal);
  const deliveryFee = toNumber(row.delivery_fee);
  const total = toNumber(row.total);

  if (!type || !Number.isFinite(subtotal) || !Number.isFinite(deliveryFee) || !Number.isFinite(total)) {
    throw new Error("Unsupported partner order payload.");
  }

  return {
    id: row.id,
    clientUserId: row.client_id,
    businessId: row.business_id,
    type,
    status: row.status as OrderStatus,
    items,
    subtotal,
    deliveryFee,
    total,
    currency: "KGS",
    paymentStatus: row.payment_status as PaymentStatus,
    deliveryStatus: undefined,
    createdAt: row.created_at
  };
}

export async function getPartnerOrdersFromSupabase(): Promise<PartnerOrdersReadResult> {
  const [config, partner] = await Promise.all([getAuthenticatedRestConfig(), requirePartner()]);

  if (!config) {
    return createSupabasePartnerOrdersResult({
      ok: false,
      code: "supabase_not_configured",
      message: "Supabase read environment is not configured."
    });
  }

  if (!partner.ok || !partner.data.partnerId || config.userId !== partner.data.userId) {
    return createSupabasePartnerOrdersResult({
      ok: false,
      code: "read_failed",
      message: "Partner orders are not available for this authenticated identity."
    });
  }

  try {
    const ordersUrl = new URL(`${config.restUrl}/orders`);
    ordersUrl.searchParams.set("business_id", `eq.${partner.data.partnerId}`);
    ordersUrl.searchParams.set("select", partnerOrderFields);
    ordersUrl.searchParams.set("order", "created_at.desc");

    const ordersResponse = await fetch(ordersUrl.toString(), {
      method: "GET",
      headers: getAuthenticatedRestHeaders(config),
      cache: "no-store"
    });

    if (!ordersResponse.ok) {
      return createSupabasePartnerOrdersResult({ ok: false, code: "read_failed", message: "Partner orders could not be read safely." });
    }

    const ordersPayload: unknown = await ordersResponse.json();
    if (!Array.isArray(ordersPayload)) {
      return createSupabasePartnerOrdersResult({ ok: false, code: "read_failed", message: "Partner orders response was not valid." });
    }

    const rows = ordersPayload as SupabasePartnerOrderRow[];
    if (rows.some((row) => !row || row.business_id !== partner.data.partnerId || toOrderType(row.type) === null)) {
      return createSupabasePartnerOrdersResult({ ok: false, code: "read_failed", message: "Partner orders response did not match the authenticated business." });
    }

    if (rows.length === 0) {
      return createSupabasePartnerOrdersResult({
        ok: false,
        orders: [],
        code: "empty_result",
        message: "No Supabase partner orders were found for the authenticated business."
      });
    }

    const orderIds = rows.map((row) => row.id);
    const itemsUrl = new URL(`${config.restUrl}/order_items`);
    itemsUrl.searchParams.set("order_id", `in.(${orderIds.join(",")})`);
    itemsUrl.searchParams.set("select", partnerOrderItemFields);
    itemsUrl.searchParams.set("order", "created_at.asc");

    const itemsResponse = await fetch(itemsUrl.toString(), {
      method: "GET",
      headers: getAuthenticatedRestHeaders(config),
      cache: "no-store"
    });

    if (!itemsResponse.ok) {
      return createSupabasePartnerOrdersResult({ ok: false, code: "read_failed", message: "Partner order items could not be read safely." });
    }

    const itemsPayload: unknown = await itemsResponse.json();
    if (!Array.isArray(itemsPayload)) {
      return createSupabasePartnerOrdersResult({ ok: false, code: "read_failed", message: "Partner order items response was not valid." });
    }

    const allowedOrderIds = new Set(orderIds);
    const itemRows = itemsPayload as SupabasePartnerOrderItemRow[];
    if (itemRows.some((row) => !row || !allowedOrderIds.has(row.order_id))) {
      return createSupabasePartnerOrdersResult({ ok: false, code: "read_failed", message: "Partner order items escaped the authenticated order scope." });
    }

    const itemsByOrder = new Map<string, OrderItem[]>();
    for (const itemRow of itemRows) {
      const item = mapOrderItem(itemRow);
      const existing = itemsByOrder.get(item.orderId) ?? [];
      existing.push(item);
      itemsByOrder.set(item.orderId, existing);
    }

    const orders = rows.map((row) => mapSupabaseOrder(row, itemsByOrder.get(row.id) ?? []));

    return createSupabasePartnerOrdersResult({
      ok: true,
      orders,
      message: "Partner orders and item snapshots read from the authenticated business scope."
    });
  } catch {
    return createSupabasePartnerOrdersResult({
      ok: false,
      code: "server_error",
      message: "Partner orders read failed safely."
    });
  }
}
