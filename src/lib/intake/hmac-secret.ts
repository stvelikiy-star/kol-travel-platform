import { createHmac } from "node:crypto";

// The public intake fingerprint key is purpose-specific. It MUST NOT be the
// Supabase service-role credential, even as a fallback.
export function resolveIntakeHmacSecret(configured: string | undefined, serviceRoleKey: string | undefined): string {
  if (typeof configured !== "string" || Buffer.byteLength(configured, "utf8") < 32 ||
      configured !== configured.trim() || /\s/.test(configured)) {
    throw new Error("intake_hmac_secret_missing_or_weak");
  }
  if (serviceRoleKey && configured === serviceRoleKey) {
    throw new Error("intake_hmac_secret_must_be_independent");
  }
  return configured;
}

export function hashIntakeIdentifier(secret: string, kind: "phone" | "ip", value: string): string {
  if (kind !== "phone" && kind !== "ip") throw new Error("intake_hmac_identifier_invalid");
  return createHmac("sha256", secret).update(kind + ":" + value, "utf8").digest("hex");
}
