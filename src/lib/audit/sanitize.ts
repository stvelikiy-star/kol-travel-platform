const blockedKeyParts = [
  "password",
  "token",
  "secret",
  "service_role",
  "servicerole",
  "authorization",
  "cookie",
  "payment_card",
  "card_number",
  "cvv",
  "private_key",
  "env",
  "session",
  "supabase"
];

function isBlockedKey(key: string) {
  const normalized = key.toLowerCase().replace(/[^a-z0-9_]/g, "");
  return blockedKeyParts.some((part) => normalized.includes(part));
}

export function sanitizeAuditState(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAuditState(item));
  }

  if (typeof value === "object") {
    const safeObject: Record<string, unknown> = {};

    for (const [key, entryValue] of Object.entries(value as Record<string, unknown>)) {
      if (isBlockedKey(key)) {
        continue;
      }

      safeObject[key] = sanitizeAuditState(entryValue);
    }

    return safeObject;
  }

  return undefined;
}
