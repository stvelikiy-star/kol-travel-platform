"use server";

import { requirePartner } from "@/lib/auth/roles";
import {
  getAuthenticatedRestConfig,
  getAuthenticatedRestHeaders,
  type AuthenticatedRestConfig
} from "@/lib/data/authenticated-read-utils";

type RealPartnerOrderActionResult = {
  ok: boolean;
  mode: "real";
  action: "mark_order_ready_for_pickup";
  message: string;
  role: "partner";
  riskLevel: "medium";
  auditRequired: true;
  humanApprovalRequired: false;
  alcoholModuleEnabled: false;
  auditLogId?: string;
  code?: string;
};

type SupabaseOrderRow = {
  id: string;
  business_id: string;
  status: string;
  payment_status: string;
  updated_at: string;
};

type SupabaseAuditRow = { id: string };

const allowedReadyForPickupSourceStatuses = ["preparing", "accepted_by_partner"];

function createResult(input: {
  ok: boolean;
  message: string;
  code?: string;
  auditLogId?: string;
}): RealPartnerOrderActionResult {
  return {
    ok: input.ok,
    mode: "real",
    action: "mark_order_ready_for_pickup",
    message: input.message,
    role: "partner",
    riskLevel: "medium",
    auditRequired: true,
    humanApprovalRequired: false,
    alcoholModuleEnabled: false,
    code: input.code,
    auditLogId: input.auditLogId
  };
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

async function readOwnedOrder(config: AuthenticatedRestConfig, orderId: string, businessId: string) {
  const url = new URL(`${config.restUrl}/orders`);
  url.searchParams.set("id", `eq.${orderId}`);
  url.searchParams.set("business_id", `eq.${businessId}`);
  url.searchParams.set("select", "id,business_id,status,payment_status,updated_at");
  url.searchParams.set("limit", "1");

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: getAuthenticatedRestHeaders(config),
    cache: "no-store"
  });

  if (!response.ok) return null;
  const rows = (await response.json()) as SupabaseOrderRow[];
  return rows[0] ?? null;
}

function createSafeOrderState(order: SupabaseOrderRow) {
  return {
    id: order.id,
    business_id: order.business_id,
    status: order.status,
    payment_status: order.payment_status,
    updated_at: order.updated_at
  };
}

async function updateOrderReadyForPickup(config: AuthenticatedRestConfig, orderId: string, businessId: string) {
  const url = new URL(`${config.restUrl}/orders`);
  url.searchParams.set("id", `eq.${orderId}`);
  url.searchParams.set("business_id", `eq.${businessId}`);
  url.searchParams.set("status", "in.(preparing,accepted_by_partner)");
  url.searchParams.set("select", "id,business_id,status,payment_status,updated_at");

  const response = await fetch(url.toString(), {
    method: "PATCH",
    headers: {
      ...getAuthenticatedRestHeaders(config),
      "content-type": "application/json",
      prefer: "return=representation"
    },
    body: JSON.stringify({
      status: "ready_for_pickup",
      updated_at: new Date().toISOString()
    })
  });

  if (!response.ok) return null;
  const rows = (await response.json()) as SupabaseOrderRow[];
  return rows[0] ?? null;
}

async function insertAuditLog(config: AuthenticatedRestConfig, input: {
  actorUserId: string;
  orderId: string;
  beforeState: ReturnType<typeof createSafeOrderState>;
  afterState: ReturnType<typeof createSafeOrderState>;
}) {
  // Existing audit_logs INSERT policy already permits authenticated users when
  // auth.uid() is present. Keep the audit write in the same user JWT/RLS scope
  // as the business action; no service-role bypass is needed here.
  const response = await fetch(`${config.restUrl}/audit_logs`, {
    method: "POST",
    headers: {
      ...getAuthenticatedRestHeaders(config),
      "content-type": "application/json",
      prefer: "return=representation"
    },
    body: JSON.stringify({
      actor_id: input.actorUserId,
      actor_role: "partner",
      action: "mark_order_ready_for_pickup",
      entity_type: "orders",
      entity_id: input.orderId,
      before: input.beforeState,
      after: input.afterState,
      reason: "Partner marked order ready for pickup.",
      request_id: `mark-ready-${input.orderId}`
    })
  });

  if (!response.ok) return null;
  const rows = (await response.json()) as SupabaseAuditRow[];
  return rows[0]?.id ?? null;
}

export async function markOrderReadyForPickupAction(orderId: string): Promise<RealPartnerOrderActionResult> {
  if (!orderId || !isUuid(orderId)) {
    return createResult({ ok: false, code: "invalid_order_id", message: "Invalid order id." });
  }

  const [config, partner] = await Promise.all([getAuthenticatedRestConfig(), requirePartner()]);
  if (!config || !partner.ok || !partner.data.partnerId) {
    return createResult({
      ok: false,
      code: "not_authorized",
      message: "Authenticated partner access is required."
    });
  }

  try {
    const actorUserId = partner.data.userId;
    const businessId = partner.data.partnerId;
    const order = await readOwnedOrder(config, orderId, businessId);

    if (!order) {
      return createResult({
        ok: false,
        code: "ownership_failed",
        message: "Order is not available for the current partner."
      });
    }

    if (!allowedReadyForPickupSourceStatuses.includes(order.status)) {
      return createResult({
        ok: false,
        code: "invalid_status_transition",
        message: "This order cannot be marked ready for pickup from its current status."
      });
    }

    const beforeState = createSafeOrderState(order);
    const updatedOrder = await updateOrderReadyForPickup(config, orderId, businessId);

    if (!updatedOrder) {
      return createResult({
        ok: false,
        code: "database_update_failed",
        message: "Order status could not be updated."
      });
    }

    const auditLogId = await insertAuditLog(config, {
      actorUserId,
      orderId,
      beforeState,
      afterState: createSafeOrderState(updatedOrder)
    });

    if (!auditLogId) {
      return createResult({
        ok: false,
        code: "audit_insert_failed",
        message: "Order was updated, but audit log could not be created. Review the test database before continuing."
      });
    }

    return createResult({ ok: true, message: "Order marked ready for pickup.", auditLogId });
  } catch {
    return createResult({
      ok: false,
      code: "server_error",
      message: "Order could not be marked ready for pickup."
    });
  }
}
