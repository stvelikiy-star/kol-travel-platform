"use server";

import { createHash, createHmac, randomUUID } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { getServerSupabaseConfig } from "@/lib/supabase/types";

export type PublicIntakeKind = "order_request" | "booking_request" | "support";

export type PublicIntakeResult =
  | { ok: true; requestId: string; message: string }
  | { ok: false; code: "validation_error" | "backend_unavailable" | "insert_failed" | "rate_limited"; message: string };

export type PublicIntakeInput = {
  kind: PublicIntakeKind;
  title: string;
  contact: { name: string; phone: string; email?: string };
  payload: Record<string, unknown>;
  /** Stable UUID v4 from the submitting form. Retries must keep the same ID. */
  requestId?: string;
};

const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedKinds = new Set<PublicIntakeKind>(["order_request", "booking_request", "support"]);

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function invalid(message: string): PublicIntakeResult {
  return { ok: false, code: "validation_error", message };
}

export async function submitPublicIntakeRequest(input: PublicIntakeInput): Promise<PublicIntakeResult> {
  // This is an anonymous Server Action, not a direct public-table INSERT.
  // Never accept a role, ticket status, priority or owner from user input.
  if (!input || typeof input !== "object" || !allowedKinds.has(input.kind)) {
    return invalid("Неверный тип заявки.");
  }

  const title = text(input.title, 160);
  const name = text(input.contact?.name, 120);
  const phone = text(input.contact?.phone, 40);
  const email = text(input.contact?.email, 160);
  const digits = phone.replace(/\D/g, "");

  if (title.length < 3 || name.length < 2 || digits.length < 7 || digits.length > 15 ||
      !/^\+?[0-9 ()-]{7,40}$/.test(phone)) {
    return invalid("Укажите корректные имя и телефон для связи с оператором.");
  }
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return invalid("Укажите корректный email или оставьте поле пустым.");
  }
  if (!input.payload || typeof input.payload !== "object" || Array.isArray(input.payload)) {
    return invalid("Данные заявки имеют неверный формат.");
  }
  if (input.requestId !== undefined && (typeof input.requestId !== "string" || !uuidV4.test(input.requestId))) {
    return invalid("Неверный идентификатор повторного запроса.");
  }

  let rawPayload: Record<string, unknown>;
  let canonical: string;
  try {
    const serialized = JSON.stringify(input.payload);
    if (!serialized || Buffer.byteLength(serialized, "utf8") > 9500) {
      return invalid("Заявка содержит слишком много данных.");
    }
    rawPayload = JSON.parse(serialized) as Record<string, unknown>;
    canonical = JSON.stringify({ kind: input.kind, title, name, phone: digits, email, payload: rawPayload });
  } catch {
    return invalid("Не удалось подготовить данные заявки.");
  }

  const requestId = input.requestId ?? randomUUID();
  const fingerprint = createHash("sha256").update(canonical).digest("hex");

  let backendStage = "initialization";
  try {
    // The service-role credential never leaves server-side code; RLS remains
    // enabled and anonymous users retain no direct support_tickets INSERT.
    backendStage = "server_config";
    const secret = getServerSupabaseConfig().serviceRoleKey;
    if (!secret) throw new Error("public_intake_service_role_missing");
    const service = createSupabaseServiceRoleClient();
    const phoneHash = createHmac("sha256", secret).update(digits).digest("hex");

    // Retries of an already committed request are safe and do not make
    // duplicates, even when the network drops after the original INSERT.
    backendStage = "idempotency_lookup";
    const { data: existing, error: lookupError } = await service
      .from("support_tickets")
      .select("id,category,request_payload")
      .eq("id", requestId)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (existing) {
      if (existing.category === input.kind &&
          existing.request_payload?.request_fingerprint === fingerprint) {
        return { ok: true, requestId, message: "Заявка уже сохранена. Повтор не создан." };
      }
      return invalid("Этот идентификатор уже используется для другой заявки.");
    }

    // A small persistent anti-spam gate. Use a keyed digest, not a searchable
    // raw phone number. Rate-limit failure must fail closed.
    backendStage = "rate_limit_lookup";
    const { data: recent, error: throttleError } = await service
      .from("support_tickets")
      .select("id")
      .eq("request_payload->>contact_phone_hash", phoneHash)
      .gte("created_at", new Date(Date.now() - 15 * 60_000).toISOString())
      .limit(4);
    if (throttleError || !Array.isArray(recent)) throw throttleError ?? new Error("intake_throttle_unavailable");
    if (recent.length >= 4) {
      return { ok: false, code: "rate_limited", message: "Слишком много заявок за короткое время. Попробуйте позднее." };
    }

    backendStage = "anonymous_auth_probe";
    const userClient = await createSupabaseServerClient();
    if (!userClient) throw new Error("public_intake_auth_client_missing");
    const { data: authData } = await userClient.auth.getUser();
    const createdBy = authData.user?.id ?? null;
    const requestPayload = {
      ...rawPayload,
      contact: { name, phone, ...(email ? { email } : {}) },
      contact_phone_hash: phoneHash,
      request_fingerprint: fingerprint,
      intake_version: 2,
      submitted_at: new Date().toISOString()
    };

    backendStage = "ticket_insert";
    const { error } = await service.from("support_tickets").insert({
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
      // Concurrent duplicate submission: check that the payload really matches.
      if (error.code === "23505") {
        const { data: replay } = await service
          .from("support_tickets").select("category,request_payload").eq("id", requestId).maybeSingle();
        if (replay?.category === input.kind &&
            replay.request_payload?.request_fingerprint === fingerprint) {
          return { ok: true, requestId, message: "Заявка уже сохранена. Повтор не создан." };
        }
      }
      console.error("KOL public intake insert failed", { code: error.code, kind: input.kind, requestId });
      return { ok: false, code: "insert_failed", message: "Заявка не была сохранена. Попробуйте ещё раз." };
    }

    return { ok: true, requestId, message: "Заявка сохранена. Оператор KÖL подтвердит детали вручную." };
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error && typeof error.code === "string"
      ? error.code.slice(0, 40) : "unexpected";
    console.error("KOL public intake backend unavailable", JSON.stringify({
      kind: input.kind, requestId, stage: backendStage, code
    }));
    return { ok: false, code: "backend_unavailable", message: "Сервис заявок временно недоступен. Попробуйте ещё раз." };
  }
}
