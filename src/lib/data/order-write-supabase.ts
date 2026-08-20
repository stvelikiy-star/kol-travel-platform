import {
  getAuthenticatedRestConfig,
  getAuthenticatedRestHeaders
} from "@/lib/data/authenticated-read-utils";

export type AtomicOrderItemInput = {
  itemId: string;
  qty: number;
};

export type AtomicOrderCreateInput = {
  businessId: string;
  orderType: "food" | "shop";
  items: AtomicOrderItemInput[];
  deliveryMethod: "pickup";
  idempotencyKey: string;
};

export type AtomicOrderWriteResult = {
  ok: boolean;
  orderId?: string;
  code?: string;
  message: string;
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function fail(code: string, message: string): AtomicOrderWriteResult {
  return { ok: false, code, message };
}

async function parseRpcUuid(response: Response) {
  if (!response.ok) return null;

  const payload: unknown = await response.json();
  return typeof payload === "string" && isUuid(payload) ? payload : null;
}

export async function createAtomicOrderFromSupabase(
  input: AtomicOrderCreateInput
): Promise<AtomicOrderWriteResult> {
  if (!isUuid(input.businessId)) {
    return fail("invalid_business_id", "Invalid business id.");
  }

  if (!input.idempotencyKey || input.idempotencyKey.length < 8 || input.idempotencyKey.length > 128) {
    return fail("invalid_idempotency_key", "Invalid idempotency key.");
  }

  if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 50) {
    return fail("invalid_items", "Order items are invalid.");
  }

  if (
    input.items.some(
      (item) => !isUuid(item.itemId) || !Number.isInteger(item.qty) || item.qty < 1 || item.qty > 99
    )
  ) {
    return fail("invalid_items", "Order items are invalid.");
  }

  const config = await getAuthenticatedRestConfig();
  if (!config) {
    return fail("supabase_not_configured", "Supabase order write is not configured.");
  }

  try {
    const response = await fetch(`${config.restUrl}/rpc/create_order_atomic`, {
      method: "POST",
      headers: {
        ...getAuthenticatedRestHeaders(config),
        "content-type": "application/json"
      },
      cache: "no-store",
      body: JSON.stringify({
        p_business_id: input.businessId,
        p_order_type: input.orderType,
        p_items: input.items.map((item) => ({ item_id: item.itemId, qty: item.qty })),
        p_delivery_method: input.deliveryMethod,
        p_idempotency_key: input.idempotencyKey
      })
    });

    const orderId = await parseRpcUuid(response);
    if (!orderId) {
      return fail("order_rpc_failed", "Order could not be created safely.");
    }

    return {
      ok: true,
      orderId,
      message: "Order created through the atomic database transaction."
    };
  } catch {
    return fail("server_error", "Order could not be created safely.");
  }
}

export async function markOrderReadyForPickupAtomicFromSupabase(
  orderId: string
): Promise<AtomicOrderWriteResult> {
  if (!isUuid(orderId)) {
    return fail("invalid_order_id", "Invalid order id.");
  }

  const config = await getAuthenticatedRestConfig();
  if (!config) {
    return fail("supabase_not_configured", "Supabase order write is not configured.");
  }

  try {
    const response = await fetch(`${config.restUrl}/rpc/mark_order_ready_for_pickup_atomic`, {
      method: "POST",
      headers: {
        ...getAuthenticatedRestHeaders(config),
        "content-type": "application/json"
      },
      cache: "no-store",
      body: JSON.stringify({ p_order_id: orderId })
    });

    const updatedOrderId = await parseRpcUuid(response);
    if (!updatedOrderId || updatedOrderId !== orderId) {
      return fail("order_transition_rpc_failed", "Order status could not be changed safely.");
    }

    return {
      ok: true,
      orderId: updatedOrderId,
      message: "Order marked ready for pickup atomically."
    };
  } catch {
    return fail("server_error", "Order status could not be changed safely.");
  }
}
