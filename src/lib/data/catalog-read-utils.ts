import { getPublicSupabaseConfig } from "@/lib/supabase/types";

export const catalogReadTimeoutMs = 1500;

export function getSupabaseRestConfig() {
  const config = getPublicSupabaseConfig();

  if (!config.url || !config.publicKey) {
    return null;
  }

  return {
    restUrl: `${config.url.replace(/\/$/, "")}/rest/v1`,
    apiKey: config.publicKey
  };
}

export async function fetchSupabaseJson<T>(url: URL, apiKey: string, accessToken?: string): Promise<{
  ok: boolean;
  rows: T[];
  status: number;
}> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), catalogReadTimeoutMs);

  try {
    const headers: Record<string, string> = {
      accept: "application/json",
      apikey: apiKey
    };
    if (accessToken) {
      headers.authorization = `Bearer ${accessToken}`;
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers,
      cache: "no-store",
      signal: controller.signal
    });

    if (!response.ok) {
      return { ok: false, rows: [], status: response.status };
    }

    const rows = (await response.json()) as T[];
    return { ok: true, rows, status: response.status };
  } finally {
    clearTimeout(timeout);
  }
}

export function toNumber(value: number | string | null | undefined, fallback = 0) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

export function toText(value: string | null | undefined, fallback = "") {
  return value && value.trim().length > 0 ? value : fallback;
}

export function toIsoText(value: string | null | undefined) {
  return value ?? "";
}
