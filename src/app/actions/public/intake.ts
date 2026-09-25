"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PublicIntakeKind = "order_request" | "booking_request" | "support";

export type PublicIntakeResult =
  | { ok: true; requestId: string; message: string }
  | { ok: false; code: "validation_error" | "backend_unavailable" | "insert_failed"; message: string };

export type PublicIntakeInput = {
  kind: PublicIntakeKind;
  title: string;
  contact: {
    name: string;
    phone: string;
    email?: string;
  };
  payload: Record<string, unknown>;
};

function cleanText(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function submitPublicIntakeRequest(input: PublicIntakeInput): Promise<PublicIntakeResult> {
  const title = cleanText(input.title, 160);
  const name = cleanText(input.contact?.name, 120);
  const phone = cleanText(input.contact?.phone, 80);
  const email = cleanText(input.contact?.email, 160);

  if (!(["order_request", "booking_request", "support"] as string[]).includes(input.kind)) {
    return { ok: false, code: "validation_error", message: "Неверный тип заявки." };
  }

  if (title.length < 3 || name.length < 2 || phone.length < 5) {
    return {
      ok: false,
      code: "validation_error",
      message: "Укажите имя и телефон, чтобы оператор мог подтвердить заявку."
    };
  }

  const requestId = crypto.randomUUID();
  const requestPayload = {
    ...input.payload,
    contact: {
      name,
      phone,
      ...(email ? { email } : {})
    },
    intake_version: 1,
    submitted_at: new Date().toISOString()
  };

  let encodedPayload = "";
  try {
    encodedPayload = JSON.stringify(requestPayload);
  } catch {
    return { ok: false, code: "validation_error", message: "Не удалось подготовить данные заявки." };
  }

  if (encodedPayload.length > 11000) {
    return { ok: false, code: "validation_error", message: "Заявка содержит слишком много данных." };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      ok: false,
      code: "backend_unavailable",
      message: "Сервис заявок временно недоступен. Попробуйте ещё раз."
    };
  }

  const { data: authData } = await supabase.auth.getUser();
  const createdBy = authData.user?.id ?? null;

  const { error } = await supabase.from("support_tickets").insert({
    id: requestId,
    created_by: createdBy,
    related_order_id: null,
    related_booking_id: null,
    category: input.kind,
    priority: "medium",
    status: "open",
    title,
    request_payload: requestPayload
  });

  if (error) {
    console.error("KOL public intake insert failed", {
      code: error.code,
      message: error.message,
      kind: input.kind,
      requestId
    });
    return {
      ok: false,
      code: "insert_failed",
      message: "Заявка не была сохранена. Подтверждение не создано — попробуйте ещё раз."
    };
  }

  return {
    ok: true,
    requestId,
    message: "Заявка сохранена. Оператор KÖL подтвердит детали вручную."
  };
}
