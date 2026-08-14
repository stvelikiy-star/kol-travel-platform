import { getCurrentSession } from "@/lib/auth/session";
import { requirePartner } from "@/lib/auth/roles";
import { getServerSupabaseConfig } from "@/lib/supabase/types";

export type AuthenticatedRestConfig = {
  restUrl: string;
  apiKey: string;
  accessToken: string;
  userId: string;
};

export type PartnerReadContext = {
  businessId: string;
  rest: AuthenticatedRestConfig;
};

export type PartnerReadFailure = {
  ok: false;
  data: null;
  source: "supabase";
  error: "unavailable";
};

export type PartnerReadSuccess<T> = {
  ok: true;
  data: T;
  source: "mock" | "supabase";
};

export type PartnerReadResult<T> = PartnerReadSuccess<T> | PartnerReadFailure;

type PartnerReadTable =
  | "bookings"
  | "partners"
  | "room_availability"
  | "rooms"
  | "stays"
  | "tour_schedules"
  | "tours";

export async function getAuthenticatedRestConfig(): Promise<AuthenticatedRestConfig | null> {
  try {
    const session = await getCurrentSession();
    const config = getServerSupabaseConfig();

    if (!session.ok || !session.data.accessToken || !config.url || !config.publicKey) {
      return null;
    }

    return {
      restUrl: `${config.url.replace(/\/$/, "")}/rest/v1`,
      apiKey: config.publicKey,
      accessToken: session.data.accessToken,
      userId: session.data.id
    };
  } catch {
    return null;
  }
}

export function getAuthenticatedRestHeaders(config: AuthenticatedRestConfig) {
  return {
    accept: "application/json",
    apikey: config.apiKey,
    authorization: `Bearer ${config.accessToken}`
  };
}

export function failedPartnerRead(): PartnerReadFailure {
  return { ok: false, data: null, source: "supabase", error: "unavailable" };
}

export async function readAuthenticatedRows(
  config: AuthenticatedRestConfig,
  table: PartnerReadTable,
  query: Record<string, string>
): Promise<unknown[] | null> {
  try {
    const url = new URL(`${config.restUrl}/${table}`);

    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }

    const response = await fetch(url, {
      cache: "no-store",
      headers: getAuthenticatedRestHeaders(config)
    });

    if (!response.ok) {
      return null;
    }

    const body: unknown = await response.json();
    return Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}

export async function getAuthenticatedPartnerReadContext(): Promise<PartnerReadContext | null> {
  try {
    const [profile, rest] = await Promise.all([requirePartner(), getAuthenticatedRestConfig()]);

    if (
      !profile.ok ||
      !profile.data.partnerId ||
      !rest ||
      rest.userId !== profile.data.userId
    ) {
      return null;
    }

    const businessId = profile.data.partnerId;

    if (!/^[A-Za-z0-9_-]{1,128}$/.test(businessId)) {
      return null;
    }

    const ownershipRows = await readAuthenticatedRows(rest, "partners", {
      select: "id",
      id: `eq.${businessId}`,
      limit: "2"
    });

    if (
      !ownershipRows ||
      ownershipRows.length !== 1 ||
      typeof ownershipRows[0] !== "object" ||
      ownershipRows[0] === null ||
      (ownershipRows[0] as Record<string, unknown>).id !== businessId
    ) {
      return null;
    }

    return { businessId, rest };
  } catch {
    return null;
  }
}
