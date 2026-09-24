"use server";

import { requireClient } from "@/lib/auth/roles";
import { createClientSupportTicketFromSupabase } from "@/lib/data/client-support-supabase";

type MvpOrderRequestItem = {
  itemId: string;
  qty: number;
  label?: string;
};

type MvpOrderRequestInput = {
  businessId: string;
  orderType: "food" | "shop";
  items: MvpOrderRequestItem[];
  previewSubtotal: number;
  requestId: string;
};

type MvpOrderRequestResult = {
  ok: boolean;
  ticketId?: string;
  code?: string;
  message: string;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fail(code: string, message: string): MvpOrderRequestResult {
  return { ok: false, code, message };
}

function cleanLabel(value: string | undefined) {
  return (value ?? "Позиция").replace(/[\r\n\t]+/g, " ").trim().slice(0, 120) || "Позиция";
}

export async function createMvpOrderRequestAction(
  input: MvpOrderRequestInput
): Promise<MvpOrderRequestResult> {
  const client = await requireClient();
  if (!client.ok) {
    return fail("not_authorized", "Active client access is required.");
  }

  if (!uuidPattern.test(input.businessId)) {
    return fail("invalid_business_id", "Invalid business id.");
  }

  if (input.orderType !== "food" && input.orderType !== "shop") {
    return fail("invalid_order_type", "Invalid order type.");
  }

  if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 50) {
    return fail("invalid_items", "Request items are invalid.");
  }

  if (
    input.items.some(
      (item) => !uuidPattern.test(item.itemId) || !Number.isInteger(item.qty) || item.qty < 1 || item.qty > 99
    )
  ) {
    return fail("invalid_items", "Request items are invalid.");
  }

  if (
    typeof input.previewSubtotal !== "number" ||
    !Number.isFinite(input.previewSubtotal) ||
    input.previewSubtotal < 0 ||
    input.previewSubtotal > 100_000_000
  ) {
    return fail("invalid_preview_total", "Preview total is invalid.");
  }

  const requestId = input.requestId.trim();
  if (requestId.length < 8 || requestId.length > 128) {
    return fail("invalid_request_id", "Request id is invalid.");
  }

  const typeLabel = input.orderType === "food" ? "еда" : "магазин";
  const lines = input.items.map(
    (item, index) => `${index + 1}. ${cleanLabel(item.label)} · ${item.itemId} · ${item.qty} шт.`
  );

  const result = await createClientSupportTicketFromSupabase({
    category: "order_request",
    title: `Заявка на заказ · ${typeLabel}`,
    message: [
      "MVP-заявка оператору KÖL.",
      `Тип: ${input.orderType}.`,
      `Business ID: ${input.businessId}.`,
      "Позиции:",
      ...lines,
      `Предварительная сумма в интерфейсе: ${input.previewSubtotal} KGS.`,
      "Важно: это не подтверждённый заказ и не оплата. Оператор должен проверить наличие, цену и подтвердить заявку вручную."
    ].join("\n"),
    requestId,
    relatedOrderId: null,
    relatedBookingId: null
  });

  if (!result.ok || !result.ticketId) {
    return fail(result.code ?? "request_failed", result.message);
  }

  return {
    ok: true,
    ticketId: result.ticketId,
    message: "Заявка передана оператору. Заказ и оплата не подтверждены."
  };
}
