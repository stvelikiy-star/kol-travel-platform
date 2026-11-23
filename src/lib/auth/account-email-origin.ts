/**
 * Outbound auth emails must point to our explicitly configured HTTPS site,
 * never to a user-controlled Host / X-Forwarded-Host header.
 */
export function getAccountEmailOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const allowLocal = process.env.NODE_ENV !== "production" &&
      url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
    if (!(url.protocol === "https:" || allowLocal) ||
        url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

export function getAccountEmailCallback(next: string) {
  const origin = getAccountEmailOrigin();
  if (!origin) return null;
  const url = new URL("/auth/callback", origin);
  url.searchParams.set("next", next);
  return url.toString();
}
