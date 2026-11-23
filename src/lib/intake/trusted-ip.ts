import { isIP } from "node:net";

// The selected header must be set and normalized by a trusted ingress proxy.
// Vercel overwrites X-Forwarded-For; do not trust arbitrary forwarded chains
// when this application is deployed behind another type of proxy.
const trustedHeaderNames = new Set(["cf-connecting-ip", "x-real-ip", "x-forwarded-for"]);

export function trustedIntakeIp(requestHeaders: Pick<Headers, "get">, configuredHeader: string | undefined): string | null {
  const name = configuredHeader?.trim().toLowerCase();
  if (!name || !trustedHeaderNames.has(name)) return null;
  const raw = requestHeaders.get(name);
  // Only one bare canonical IP. Never accept a comma-separated forwarded chain
  // or silently choose a caller-controlled leftmost IP for rate-limit buckets.
  if (!raw || raw !== raw.trim() || raw.includes(",") || raw.length > 45) return null;
  return isIP(raw) ? raw : null;
}
