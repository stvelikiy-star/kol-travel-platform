"use server";

import { createHash, createHmac, randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { getServerSupabaseConfig } from "@/lib/supabase/types";
import { trustedIntakeIp } from "@/lib/intake/trusted-ip";

export type PublicIntakeKind = "order_request" | "booking_request" | "support";
export type PublicIntakeLocale = "ru" | "ky" | "en";
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
  /** Form-level bot trap; always supplied by the UI, never included in business payload. */
  honeypot?: string;
  /** Client clock is a soft bot signal, not a security boundary. */
  formStartedAt?: number;
  locale?: PublicIntakeLocale;
};

const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedKinds = new Set<PublicIntakeKind>(["order_request", "booking_request", "support"]);
const messages = {
  ru: {
    kind: "Неверный тип заявки.", contact: "Укажите корректные имя и телефон для связи с оператором.",
    email: "Укажите корректный email или оставьте поле пустым.", payload: "Данные заявки имеют неверный формат.",
    uuid: "Неверный идентификатор повторного запроса.", size: "Заявка содержит слишком много данных.",
    invalid: "Не удалось подготовить данные заявки.", spam: "Проверьте форму и попробуйте ещё раз.",
    slow: "Форма отправлена слишком быстро. Попробуйте ещё раз.",
    rate: "Слишком много заявок за короткое время. Попробуйте позднее.",
    offline: "Сервис заявок временно недоступен. Попробуйте ещё раз.",
    conflict: "Этот идентификатор уже используется для другой заявки.",
    replay: "Заявка уже сохранена. Повтор не создан.",
    success: "Заявка сохранена. Оператор KÖL подтвердит детали вручную."
  },
  ky: {
    kind: "Өтүнмөнүн түрү туура эмес.", contact: "Атыңызды жана туура телефон номериңизди көрсөтүңүз.",
    email: "Туура email жазыңыз же бош калтырыңыз.", payload: "Өтүнмөнүн маалыматы туура эмес.",
    uuid: "Кайталоо сурамынын идентификатору туура эмес.", size: "Өтүнмөнүн көлөмү өтө чоң.",
    invalid: "Өтүнмөнү даярдоо мүмкүн болгон жок.", spam: "Форманы текшерип, кайра аракет кылыңыз.",
    slow: "Форма өтө тез жөнөтүлдү. Кайра аракет кылыңыз.",
    rate: "Кыска убакытта өтө көп өтүнмө жөнөтүлдү. Кийинчерээк аракет кылыңыз.",
    offline: "Өтүнмө кызматы убактылуу жеткиликсиз. Кайра аракет кылыңыз.",
    conflict: "Бул идентификатор башка өтүнмөдө колдонулган.",
    replay: "Өтүнмө сакталган. Кайталанган жок.",
    success: "Өтүнмө сакталды. KÖL оператору маалыматты тактайт."
  },
  en: {
    kind: "Invalid request type.", contact: "Enter a valid name and phone number.",
    email: "Enter a valid email or leave the field blank.", payload: "Invalid request payload.",
    uuid: "Invalid retry request identifier.", size: "Request data is too large.",
    invalid: "Could not prepare your request.", spam: "Check the form and try again.",
    slow: "The form was submitted too quickly. Please try again.",
    rate: "Too many requests in a short period. Please try later.",
    offline: "Request service is temporarily unavailable. Please try again.",
    conflict: "This request identifier is already used for another request.",
    replay: "Your request was already saved. No duplicate created.",
    success: "Request saved. A KÖL operator will confirm the details manually."
  }
} as const;

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}


export async function submitPublicIntakeRequest(input: PublicIntakeInput): Promise<PublicIntakeResult> {
  const lang = input?.locale === "ky" || input?.locale === "en" ? input.locale : "ru";
  const m = messages[lang];
  const invalid = (message: string): PublicIntakeResult => ({ ok: false, code: "validation_error", message });
  if (!input || typeof input !== "object" || !allowedKinds.has(input.kind)) return invalid(m.kind);

  const title = text(input.title, 160);
  const name = text(input.contact?.name, 120);
  const phone = text(input.contact?.phone, 40);
  const email = text(input.contact?.email, 160);
  const digits = phone.replace(/\D/g, "");
  if (title.length < 3 || name.length < 2 || digits.length < 7 || digits.length > 15 ||
      !/^\+?[0-9 ()-]{7,40}$/.test(phone)) return invalid(m.contact);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return invalid(m.email);
  // Prospective partners must provide a usable email for later verification,
  // but this form does not create an account or grant partner privileges.
  if (input.kind === "support" && input.payload?.request_type === "partner_application" && !email)
    return invalid(m.email);
  if (!input.payload || typeof input.payload !== "object" || Array.isArray(input.payload)) return invalid(m.payload);
  if (input.requestId !== undefined && (typeof input.requestId !== "string" || !uuidV4.test(input.requestId))) return invalid(m.uuid);
  if (typeof input.honeypot !== "string" || input.honeypot.length !== 0) return invalid(m.spam);
  if (typeof input.formStartedAt !== "number" || !Number.isFinite(input.formStartedAt)) return invalid(m.spam);
  const age = Date.now() - input.formStartedAt;
  if (age < 2500) return invalid(m.slow);
  if (age > 24 * 60 * 60_000) return invalid(m.spam);

  let rawPayload: Record<string, unknown>;
  let canonical: string;
  try {
    const serialized = JSON.stringify(input.payload);
    if (!serialized || Buffer.byteLength(serialized, "utf8") > 9500) return invalid(m.size);
    rawPayload = JSON.parse(serialized) as Record<string, unknown>;
    canonical = JSON.stringify({ kind: input.kind, title, name, phone: digits, email, payload: rawPayload });
  } catch {
    return invalid(m.invalid);
  }

  const requestId = input.requestId ?? randomUUID();
  const fingerprint = createHash("sha256").update(canonical).digest("hex");
  let stage = "init";
  try {
    stage = "trusted_ip";
    const ip = trustedIntakeIp(await headers(), process.env.KOL_INTAKE_TRUSTED_IP_HEADER);
    if (!ip) throw new Error("intake_trusted_ip_not_configured");
    stage = "config";
    const secret = process.env.KOL_INTAKE_IP_HMAC_KEY || getServerSupabaseConfig().serviceRoleKey;
    if (!secret) throw new Error("intake_hmac_key_missing");
    const phoneHash = createHmac("sha256", secret).update("phone:"+digits).digest("hex");
    const ipHash = createHmac("sha256", secret).update("ip:"+ip).digest("hex");

    stage = "auth";
    const userClient = await createSupabaseServerClient();
    if (!userClient) throw new Error("intake_auth_client_missing");
    const { data: authData, error: authError } = await userClient.auth.getUser();
    // Anonymous public requests are valid. Supabase Auth v2 returns
    // AuthSessionMissingError (often HTTP 400) when no cookie is present.
    // Ignore only that explicit absence, not general 400/API failures.
    if (authError && authError.name !== "AuthSessionMissingError" &&
        authError.status !== 401 && authError.status !== 403) throw authError;
    const createdBy = authData.user?.id ?? null;

    // The service-role credential never reaches the browser. Inserting via one
    // transaction-scoped RPC prevents concurrent rate-limit bypasses.
    stage = "atomic_rpc";
    const service = createSupabaseServiceRoleClient();
    const { data, error } = await service.rpc("kol_public_intake_atomic", {
      p_id: requestId,
      p_kind: input.kind,
      p_title: title,
      p_created_by: createdBy,
      p_payload: {
        ...rawPayload,
        contact: { name, phone, ...(email ? { email } : {}) },
        submitted_at: new Date().toISOString()
      },
      p_fingerprint: fingerprint,
      p_phone_hash: phoneHash,
      p_ip_hash: ipHash
    });
    if (error) throw error;
    if (data === "rate_limited") return { ok: false, code: "rate_limited", message: m.rate };
    if (data === "conflict") return invalid(m.conflict);
    if (data === "replay") return { ok: true, requestId, message: m.replay };
    if (data !== "inserted") throw new Error("intake_unrecognized_rpc_result");
    return { ok: true, requestId, message: m.success };
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error && typeof error.code === "string"
      ? error.code.slice(0, 40) : "unexpected";
    console.error("KOL public intake backend unavailable", { kind: input.kind, requestId, stage, code });
    return { ok: false, code: "backend_unavailable", message: m.offline };
  }
}
