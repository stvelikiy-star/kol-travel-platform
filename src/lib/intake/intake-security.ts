import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

// The ingress MUST remove user-supplied copies of this header before adding its
// own verified value. No "first IP" parsing or trust in arbitrary XFF chains.
const permittedHeaders = new Set(["cf-connecting-ip", "x-real-ip", "x-vercel-forwarded-for"]);
const minFillMs = 2500;
const maxAgeMs = 4 * 60 * 60_000;

export function intakeSecret(): string {
  const secret = process.env.KOL_PUBLIC_INTAKE_HMAC_KEY;
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) throw new Error("intake_hmac_key_not_configured");
  return secret;
}

export function trustedIntakeIp(headers: Headers): string {
  const name = process.env.KOL_INTAKE_TRUSTED_IP_HEADER?.toLowerCase().trim();
  if (!name || !permittedHeaders.has(name)) throw new Error("intake_ingress_untrusted");
  const raw = headers.get(name);
  if (!raw || raw !== raw.trim() || raw.includes(",") || raw.length > 45 || !isIP(raw)) {
    throw new Error("intake_client_ip_unverified");
  }
  return raw;
}

export function intakeDigest(label: "ip" | "phone", value: string, secret: string): string {
  return createHmac("sha256", secret).update(label).update(":").update(value).digest("hex");
}

export function createIntakeFormProof(secret: string, now = Date.now()): string {
  const prefix = `v1.${now}.${randomBytes(12).toString("hex")}`;
  const mac = createHmac("sha256", secret).update(prefix).digest("hex");
  return `${prefix}.${mac}`;
}

export function validIntakeFormProof(value: unknown, secret: string, now = Date.now()): boolean {
  if (typeof value !== "string" || value.length > 180) return false;
  const match = /^(v1\.([0-9]{13})\.[a-f0-9]{24})\.([a-f0-9]{64})$/.exec(value);
  if (!match) return false;
  const issued = Number(match[2]);
  if (!Number.isSafeInteger(issued) || now - issued < minFillMs || now - issued > maxAgeMs) return false;
  const expected = createHmac("sha256", secret).update(match[1]).digest();
  const actual = Buffer.from(match[3], "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
