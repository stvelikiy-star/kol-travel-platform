"use server";

import { createDemoActionResult, type DemoActionResult } from "@/app/actions/shared/action-result";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CreateStayBookingResult =
  | { ok: true; bookingId: string; total: number; idempotent: boolean }
  | { ok: false; code: "validation_error" | "not_authenticated" | "unavailable" | "backend_error"; message: string };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function createStayBookingAction(input: {
  roomId: string;
  startDate: string;
  endDate: string;
  guests: number;
  requestId: string;
}): Promise<CreateStayBookingResult> {
  if (!uuidPattern.test(input.roomId) || !/^\d{4}-\d{2}-\d{2}$/.test(input.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(input.endDate) || !Number.isInteger(input.guests) || input.guests < 1 || input.guests > 20 || input.requestId.trim().length < 8 || input.requestId.trim().length > 128) {
    return { ok: false, code: "validation_error", message: "Проверьте номер, даты и количество гостей." };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, code: "backend_error", message: "Сервис бронирования временно недоступен." };

  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return { ok: false, code: "not_authenticated", message: "Для мгновенной брони войдите как клиент. Без входа можно отправить заявку оператору." };

  const { data, error } = await supabase.rpc("client_stay_booking_create_atomic", {
    p_room_id: input.roomId,
    p_start_date: input.startDate,
    p_end_date: input.endDate,
    p_guests: input.guests,
    p_request_id: input.requestId.trim()
  });

  if (error) {
    const unavailable = /room_unavailable|room_not_bookable|capacity/i.test(error.message);
    return { ok: false, code: unavailable ? "unavailable" : "backend_error", message: unavailable ? "Этот номер уже недоступен на выбранные даты или не подходит по вместимости." : "Бронь не создана. Попробуйте ещё раз." };
  }

  const result = data as { ok?: boolean; booking_id?: string; total?: number | string; idempotent?: boolean } | null;
  if (!result?.ok || !result.booking_id) return { ok: false, code: "backend_error", message: "Бронь не была подтверждена системой." };
  return { ok: true, bookingId: result.booking_id, total: Number(result.total ?? 0), idempotent: result.idempotent === true };
}

// Legacy demo entrypoint retained only for callers not yet migrated to the authenticated atomic flow.
export function createBookingDemoAction(input: unknown): DemoActionResult {
  void input;
  return createDemoActionResult({ action: "client.create_booking", message: "Use the authenticated atomic stay booking action or the public operator-confirmed intake flow.", auditRequired: false });
}

export function cancelBookingRequestDemoAction(bookingId: string, reason: string): DemoActionResult {
  void bookingId; void reason;
  return createDemoActionResult({ action: "client.cancel_booking_request", message: "Cancellation remains approval-gated until the audited cancellation RPC is connected.", humanApprovalRequired: true, auditRequired: true });
}

export function updateBookingRequestDemoAction(bookingId: string, input: unknown): DemoActionResult {
  void bookingId; void input;
  return createDemoActionResult({ action: "client.update_booking_request", message: "Date changes remain approval-gated until the audited update RPC is connected.", humanApprovalRequired: true, auditRequired: true });
}
