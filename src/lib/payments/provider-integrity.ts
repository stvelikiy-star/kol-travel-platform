import "server-only";

import { createHash } from "node:crypto";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export type PaymentSubjectType = "order" | "booking";
export type VerifiedProviderPaymentStatus = "paid" | "failed" | "cancelled" | "refunded";

export type CreateProviderPaymentAttemptInput = {
  subjectType: PaymentSubjectType;
  subjectId: string;
  provider: string;
  providerReference: string;
  method: string;
};

export type VerifiedProviderPaymentEvent = {
  signatureVerified: true;
  provider: string;
  eventId: string;
  eventType: string;
  providerReference: string;
  status: VerifiedProviderPaymentStatus;
  amount?: number | null;
  payloadHash: string;
  metadata?: Record<string, string | number | boolean | null>;
};

type PaymentRpcResult = Record<string, unknown> & {
  ok?: boolean;
  applied?: boolean;
  duplicate?: boolean;
  payment_id?: string | null;
  code?: string;
};

function hasText(value: string, minLength = 1, maxLength = 255) {
  const length = value.trim().length;
  return length >= minLength && length <= maxLength;
}

function assertUuid(value: string, field: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error(`${field} must be a UUID.`);
  }
}

export function sha256ProviderPayload(rawBody: string | Uint8Array) {
  return createHash("sha256").update(rawBody).digest("hex");
}

export async function createProviderPaymentAttempt(input: CreateProviderPaymentAttemptInput) {
  assertUuid(input.subjectId, "subjectId");

  if (!hasText(input.provider, 2, 64)) throw new Error("Invalid provider.");
  if (!hasText(input.providerReference, 4, 255)) throw new Error("Invalid provider reference.");
  if (!hasText(input.method, 2, 64)) throw new Error("Invalid payment method.");

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase.rpc("create_payment_attempt_atomic", {
    p_subject_type: input.subjectType,
    p_subject_id: input.subjectId,
    p_provider: input.provider.trim(),
    p_provider_reference: input.providerReference.trim(),
    p_method: input.method.trim()
  });

  if (error) {
    return { ok: false as const, code: "payment_attempt_rpc_failed", message: error.message };
  }

  if (typeof data !== "string") {
    return { ok: false as const, code: "invalid_payment_attempt_result", message: "Payment attempt RPC returned an invalid result." };
  }

  return { ok: true as const, paymentId: data };
}

export async function applyVerifiedProviderPaymentEvent(event: VerifiedProviderPaymentEvent) {
  if (event.signatureVerified !== true) {
    return { ok: false as const, code: "provider_signature_not_verified" };
  }

  if (!hasText(event.provider, 2, 64)) return { ok: false as const, code: "invalid_provider" };
  if (!hasText(event.eventId, 3, 255)) return { ok: false as const, code: "invalid_event_id" };
  if (!hasText(event.providerReference, 4, 255)) return { ok: false as const, code: "invalid_provider_reference" };
  if (!hasText(event.payloadHash, 32, 128)) return { ok: false as const, code: "invalid_payload_hash" };

  if (event.status === "paid" && (!Number.isFinite(event.amount) || Number(event.amount) <= 0)) {
    return { ok: false as const, code: "invalid_paid_amount" };
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase.rpc("apply_verified_payment_event_atomic", {
    p_provider: event.provider.trim(),
    p_event_id: event.eventId.trim(),
    p_event_type: event.eventType.trim() || "unknown",
    p_provider_reference: event.providerReference.trim(),
    p_verified_status: event.status,
    p_amount: event.amount ?? null,
    p_payload_hash: event.payloadHash.trim(),
    p_metadata: event.metadata ?? {}
  });

  if (error) {
    return { ok: false as const, code: "payment_event_rpc_failed", message: error.message };
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false as const, code: "invalid_payment_event_result" };
  }

  const result = data as PaymentRpcResult;

  return {
    ok: result.ok === true,
    applied: result.applied === true,
    duplicate: result.duplicate === true,
    paymentId: typeof result.payment_id === "string" ? result.payment_id : undefined,
    code: typeof result.code === "string" ? result.code : undefined
  };
}
