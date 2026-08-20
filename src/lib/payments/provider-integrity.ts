import "server-only";

import { createHash } from "node:crypto";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export type PaymentSubjectType = "order" | "booking";
export type VerifiedProviderPaymentStatus = "paid" | "failed" | "cancelled" | "refunded";

type SafeProviderMetadataValue = string | number | boolean | null;
export type SafeProviderMetadata = Record<string, SafeProviderMetadataValue>;

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
  metadata?: SafeProviderMetadata;
};

type PaymentRpcResult = Record<string, unknown> & {
  ok?: boolean;
  applied?: boolean;
  duplicate?: boolean;
  payment_id?: string | null;
  code?: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA256_HEX_RE = /^[0-9a-f]{64}$/;
const METADATA_KEY_RE = /^[A-Za-z0-9_.:-]{1,64}$/;
const MAX_METADATA_KEYS = 32;
const MAX_METADATA_STRING = 500;

function hasText(value: string, minLength = 1, maxLength = 255) {
  const length = value.trim().length;
  return length >= minLength && length <= maxLength;
}

function assertUuid(value: string, field: string) {
  if (!UUID_RE.test(value)) {
    throw new Error(`${field} must be a UUID.`);
  }
}

function normalizeMetadata(metadata?: SafeProviderMetadata): SafeProviderMetadata | null {
  if (!metadata) return {};

  const entries = Object.entries(metadata);
  if (entries.length > MAX_METADATA_KEYS) return null;

  const safe: SafeProviderMetadata = {};
  for (const [key, value] of entries) {
    if (!METADATA_KEY_RE.test(key)) return null;

    if (typeof value === "string") {
      if (value.length > MAX_METADATA_STRING) return null;
      safe[key] = value;
      continue;
    }

    if (typeof value === "number") {
      if (!Number.isFinite(value)) return null;
      safe[key] = value;
      continue;
    }

    if (typeof value === "boolean" || value === null) {
      safe[key] = value;
      continue;
    }

    return null;
  }

  return safe;
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
    return {
      ok: false as const,
      code: "payment_attempt_rpc_failed",
      message: "Payment attempt could not be created safely."
    };
  }

  if (typeof data !== "string" || !UUID_RE.test(data)) {
    return {
      ok: false as const,
      code: "invalid_payment_attempt_result",
      message: "Payment attempt returned an invalid result."
    };
  }

  return { ok: true as const, paymentId: data };
}

export async function applyVerifiedProviderPaymentEvent(event: VerifiedProviderPaymentEvent) {
  if (event.signatureVerified !== true) {
    return { ok: false as const, code: "provider_signature_not_verified" };
  }

  if (!hasText(event.provider, 2, 64)) return { ok: false as const, code: "invalid_provider" };
  if (!hasText(event.eventId, 3, 255)) return { ok: false as const, code: "invalid_event_id" };
  if (!hasText(event.eventType, 1, 255)) return { ok: false as const, code: "invalid_event_type" };
  if (!hasText(event.providerReference, 4, 255)) {
    return { ok: false as const, code: "invalid_provider_reference" };
  }
  if (!SHA256_HEX_RE.test(event.payloadHash)) {
    return { ok: false as const, code: "invalid_payload_hash" };
  }

  if (event.status === "paid" && (!Number.isFinite(event.amount) || Number(event.amount) <= 0)) {
    return { ok: false as const, code: "invalid_paid_amount" };
  }

  const metadata = normalizeMetadata(event.metadata);
  if (!metadata) return { ok: false as const, code: "invalid_event_metadata" };

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase.rpc("apply_verified_payment_event_atomic", {
    p_provider: event.provider.trim(),
    p_event_id: event.eventId.trim(),
    p_event_type: event.eventType.trim(),
    p_provider_reference: event.providerReference.trim(),
    p_verified_status: event.status,
    p_amount: event.amount ?? null,
    p_payload_hash: event.payloadHash,
    p_metadata: metadata
  });

  if (error) {
    return {
      ok: false as const,
      code: "payment_event_rpc_failed",
      message: "Verified payment event could not be applied safely."
    };
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
