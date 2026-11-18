"use server";

import { createHash, randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { getServerSupabaseConfig } from "@/lib/supabase/types";
import {
  createIntakeFormProof, intakeDigest, intakeSecret, trustedIntakeIp, validIntakeFormProof
} from "@/lib/intake/intake-security";

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
  locale?: "ru" | "ky" | "en";
  antiBot?: { proof: string; honeypot: string };
};

const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedKinds = new Set<PublicIntakeKind>(["order_request", "booking_request", "support"]);
type Locale = "ru" | "ky" | "en";
const notices = {
  ru: {
    invalid: "Проверьте данные заявки.",
    limit: "Слишком много заявок. Попробуйте позднее.",
    unavailable: "Проверка безопасности недоступна. Попробуйте позднее.",
    form: "Форма не готова. Обновите страницу и заполните её снова.",
    success: "Заявка сохранена. Оператор KÖL подтвердит детали вручную.",
    replay: "Заявка уже сохранена. Повтор не создан.",
    conflict: "Этот идентификатор уже используется для другой заявки."
  },
  ky: {
    invalid: "Өтүнмөнүн маалыматтарын текшериңиз.",
    limit: "Өтүнмө өтө көп жөнөтүлдү. Кийинчерээк аракет кылыңыз.",
    unavailable: "Коопсуздук текшерүүсү жеткиликсиз. Кийинчерээк аракет кылыңыз.",
    form: "Форма даяр эмес. Баракты жаңыртып, кайра толтуруңуз.",
    success: "Өтүнмө сакталды. KÖL оператору маалыматты кол менен ырастайт.",
    replay: "Өтүнмө мурда сакталган. Кайталоо түзүлгөн жок.",
    conflict: "Бул идентификатор башка өтүнмө үчүн колдонулган."
  },
  en: {
    invalid: "Please check your request details.",
    limit: "Too many requests. Please try again later.",
    unavailable: "Security verification is unavailable. Please try again later.",
    form: "The form is not ready. Reload the page and fill it in again.",
    success: "Request saved. A KÖL operator will confirm the details manually.",
    replay: "Request already saved. No duplicate created.",
    conflict: "This request ID is already used for another request."
  }
} as const;

function localeFromHeader(header: string | null): Locale {
  const preferred = (header ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
  if (preferred.startsWith("ky") || preferred.startsWith("kg")) return "ky";
  if (preferred.startsWith("en")) return "en";
  return "ru";
}
function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function invalid(message: string): PublicIntakeResult {
  return { ok: false, code: "validation_error", message };
}

/** Read-only signed proof issued when a real browser form first mounts. */
export async function issuePublicIntakeFormProof(): Promise<string | null> {
  try {
    return createIntakeFormProof(intakeSecret());
  } catch {
    return null; // No configuration: fail closed, no fallback secret.
  }
}

export async function submitPublicIntakeRequest(input: PublicIntakeInput): Promise<PublicIntakeResult> {
  // Anonymous Server Action. Never accept roles, status, priority or owner.
  const requestHeaders = await headers();
  const requestedLocale = input?.locale;
  const lang: Locale = requestedLocale === "ru" || requestedLocale === "ky" || requestedLocale === "en"
    ? requestedLocale : localeFromHeader(requestHeaders.get("accept-language"));
  const msg = notices[lang];
  if (!input || typeof input !== "object" || !allowedKinds.has(input.kind)) return invalid(msg.invalid);

  const title = text(input.title, 160);
  const name = text(input.contact?.name, 120);
  const phone = text(input.contact?.phone, 40);
  const email = text(input.contact?.email, 160);
  const digits = phone.replace(/\D/g, "");

  if (title.length < 3 || name.length < 2 || digits.length < 7 || digits.length > 15 ||
      !/^\+?[0-9 ()-]{7,40}$/.test(phone)) return invalid(msg.invalid);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return invalid(msg.invalid);
  if (!input.payload || typeof input.payload !== "object" || Array.isArray(input.payload)) return invalid(msg.invalid);
  if (input.requestId !== undefined && (typeof input.requestId !== "string" || !uuidV4.test(input.requestId))) {
    return invalid(msg.invalid);
  }

  let rawPayload: Record<string, unknown>;
  let canonical: string;
  try {
    const serialized = JSON.stringify(input.payload);
    if (!serialized || Buffer.byteLength(serialized, "utf8") > 9500) return invalid(msg.invalid);
    rawPayload = JSON.parse(serialized) as Record<string, unknown>;
    canonical = JSON.stringify({ kind: input.kind, title, name, phone: digits, email, payload: rawPayload });
  } catch {
    return invalid(msg.invalid);
  }

  const requestId = input.requestId ?? randomUUID();
  const fingerprint = createHash("sha256").update(canonical).digest("hex");

  let stage = "config";
  try {
    const secret = intakeSecret();
    if (typeof input.antiBot?.honeypot !== "string" || input.antiBot.honeypot.trim() ||
        !validIntakeFormProof(input.antiBot?.proof, secret)) {
      return invalid(msg.form);
    }

    // The trusted reverse proxy MUST strip inbound copies of the configured
    // header. If it cannot be verified, no ticket can be created.
    stage = "trusted_ip";
    const ipHash = intakeDigest("ip", trustedIntakeIp(requestHeaders), secret);
    const phoneHash = intakeDigest("phone", digits, secret);
    if (!getServerSupabaseConfig().serviceRoleKey) throw new Error("intake_service_role_missing");

    stage = "anonymous_auth_probe";
    const userClient = await createSupabaseServerClient();
    if (!userClient) throw new Error("intake_auth_client_missing");
    const { data: authData, error: authError } = await userClient.auth.getUser();
    // No authenticated session is normal, but an unavailable Auth service is not.
    if (authError && authError.name !== "AuthSessionMissingError") throw authError;
    const createdBy = authData.user?.id ?? null;

    const requestPayload = {
      ...rawPayload,
      contact: { name, phone, ...(email ? { email } : {}) },
      contact_phone_hash: phoneHash,
      contact_ip_hash: ipHash,
      request_fingerprint: fingerprint,
      intake_version: 3,
      submitted_at: new Date().toISOString()
    };

    // All idempotency, IP/phone limits and INSERT happen in a SINGLE
    // PostgreSQL transaction using transaction-scoped advisory locks.
    stage = "atomic_intake_rpc";
    const service = createSupabaseServiceRoleClient();
    const { data, error } = await service.rpc("public_intake_create_atomic", {
      p_request_id: requestId,
      p_category: input.kind,
      p_title: title,
      p_request_payload: requestPayload,
      p_request_fingerprint: fingerprint,
      p_phone_hash: phoneHash,
      p_ip_hash: ipHash,
      p_created_by: createdBy
    });
    if (error || !data || typeof data !== "object" || Array.isArray(data)) {
      throw error ?? new Error("intake_atomic_rpc_unavailable");
    }
    const result = data as Record<string, unknown>;
    if (result.ok === true && result.request_id === requestId) {
      return { ok: true, requestId, message: result.replay === true ? msg.replay : msg.success };
    }
    if (result.code === "rate_limited") return { ok: false, code: "rate_limited", message: msg.limit };
    if (result.code === "request_id_conflict") return invalid(msg.conflict);
    return invalid(msg.invalid);
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error && typeof error.code === "string"
      ? error.code.slice(0, 40) : "unavailable";
    // Never log raw IP, phone, contact payload or the signing key.
    console.error("KOL public intake fail-closed", { stage, kind: input.kind, code });
    return { ok: false, code: "backend_unavailable", message: msg.unavailable };
  }
}
