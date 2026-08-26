const allowedNextPrefixes = [
  "/client",
  "/owner",
  "/partner",
  "/courier",
  "/admin",
  "/stays",
  "/tours",
  "/food",
  "/shop",
  "/booking"
];

const allowedNextPaths = new Set(["/", "/cart", "/checkout", "/contacts"]);

function matchesAllowedPrefix(next: string, prefix: string) {
  return next === prefix || next.startsWith(`${prefix}/`) || next.startsWith(`${prefix}?`);
}

export function sanitizeLoginNextPath(value: string | null | undefined) {
  const next = typeof value === "string" ? value.trim() : "";

  // Local application paths only. Block protocol-relative URLs, backslashes and
  // control characters before applying the explicit allowlist.
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\") || /[\u0000-\u001F\u007F]/.test(next)) {
    return "/client";
  }

  if (allowedNextPaths.has(next) || allowedNextPrefixes.some((prefix) => matchesAllowedPrefix(next, prefix))) {
    return next;
  }

  return "/client";
}
