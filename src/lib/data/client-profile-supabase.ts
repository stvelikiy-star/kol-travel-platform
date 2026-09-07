import {
  getAuthenticatedRestConfig,
  getAuthenticatedRestHeaders
} from "@/lib/data/authenticated-read-utils";

export type ClientProfileData = {
  userId: string;
  fullName: string | null;
  email: string | null;
  locale: "ru" | "kg" | "en";
  defaultAddress: string | null;
};

export type ClientProfileReadResult =
  | { ok: true; profile: ClientProfileData }
  | { ok: false; profile: null; code: "supabase_not_configured" | "read_failed" | "server_error" };

export type ClientProfileUpdateInput = {
  fullName: string;
  locale: string;
  defaultAddress: string;
  requestId: string;
};

export type ClientProfileWriteResult = {
  ok: boolean;
  userId?: string;
  locale?: string;
  idempotent?: boolean;
  code?: string;
  message: string;
};

type RawUserProfile = {
  user_id?: unknown;
  full_name?: unknown;
  email?: unknown;
  locale?: unknown;
  status?: unknown;
};

type RawClientProfile = {
  user_id?: unknown;
  default_address?: unknown;
};

type RawUpdateResult = {
  ok?: unknown;
  user_id?: unknown;
  locale?: unknown;
  idempotent?: unknown;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const locales = new Set(["ru", "kg", "en"]);

function fail(code: string, message: string): ClientProfileWriteResult {
  return { ok: false, code, message };
}

function optionalString(value: unknown): string | null | undefined {
  if (value === null) return null;
  return typeof value === "string" ? value : undefined;
}

export async function getClientProfileFromSupabase(): Promise<ClientProfileReadResult> {
  const config = await getAuthenticatedRestConfig();
  if (!config) return { ok: false, profile: null, code: "supabase_not_configured" };

  try {
    const userUrl = new URL(`${config.restUrl}/user_profiles`);
    userUrl.searchParams.set("select", "user_id,full_name,email,locale,status");
    userUrl.searchParams.set("user_id", `eq.${config.userId}`);
    userUrl.searchParams.set("limit", "2");

    const clientUrl = new URL(`${config.restUrl}/client_profiles`);
    clientUrl.searchParams.set("select", "user_id,default_address");
    clientUrl.searchParams.set("user_id", `eq.${config.userId}`);
    clientUrl.searchParams.set("limit", "2");

    const [userResponse, clientResponse] = await Promise.all([
      fetch(userUrl, { cache: "no-store", headers: getAuthenticatedRestHeaders(config) }),
      fetch(clientUrl, { cache: "no-store", headers: getAuthenticatedRestHeaders(config) })
    ]);

    if (!userResponse.ok || !clientResponse.ok) {
      return { ok: false, profile: null, code: "read_failed" };
    }

    const userBody: unknown = await userResponse.json();
    const clientBody: unknown = await clientResponse.json();
    if (!Array.isArray(userBody) || !Array.isArray(clientBody) || userBody.length !== 1 || clientBody.length !== 1) {
      return { ok: false, profile: null, code: "read_failed" };
    }

    const user = (userBody[0] ?? {}) as RawUserProfile;
    const client = (clientBody[0] ?? {}) as RawClientProfile;
    const fullName = optionalString(user.full_name);
    const email = optionalString(user.email);
    const defaultAddress = optionalString(client.default_address);

    if (
      user.user_id !== config.userId ||
      client.user_id !== config.userId ||
      user.status !== "active" ||
      typeof user.locale !== "string" ||
      !locales.has(user.locale) ||
      fullName === undefined ||
      email === undefined ||
      defaultAddress === undefined
    ) {
      return { ok: false, profile: null, code: "read_failed" };
    }

    return {
      ok: true,
      profile: {
        userId: config.userId,
        fullName,
        email,
        locale: user.locale as "ru" | "kg" | "en",
        defaultAddress
      }
    };
  } catch {
    return { ok: false, profile: null, code: "server_error" };
  }
}

export async function updateClientProfileFromSupabase(
  input: ClientProfileUpdateInput
): Promise<ClientProfileWriteResult> {
  const fullName = input.fullName.trim();
  const locale = input.locale.trim().toLowerCase();
  const defaultAddress = input.defaultAddress.trim();
  const requestId = input.requestId.trim();

  if (fullName.length !== 0 && (fullName.length < 2 || fullName.length > 120)) {
    return fail("invalid_full_name", "Full name is invalid.");
  }
  if (!locales.has(locale)) return fail("invalid_locale", "Locale is invalid.");
  if (defaultAddress.length > 500) return fail("invalid_default_address", "Default address is invalid.");
  if (requestId.length < 8 || requestId.length > 128) return fail("invalid_request_id", "Profile request id is invalid.");

  const config = await getAuthenticatedRestConfig();
  if (!config) return fail("supabase_not_configured", "Supabase profile write is not configured.");

  try {
    const response = await fetch(`${config.restUrl}/rpc/client_profile_update_atomic`, {
      method: "POST",
      cache: "no-store",
      headers: {
        ...getAuthenticatedRestHeaders(config),
        "content-type": "application/json"
      },
      body: JSON.stringify({
        p_full_name: fullName,
        p_locale: locale,
        p_default_address: defaultAddress,
        p_request_id: requestId
      })
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return fail("not_authorized", "Active client access is required.");
      }
      if ([400, 409, 422].includes(response.status)) {
        return fail("profile_rejected", "Profile changes were rejected safely.");
      }
      return fail("profile_rpc_failed", "Profile changes could not be saved safely.");
    }

    const payload = (await response.json()) as RawUpdateResult;
    if (
      payload.ok !== true ||
      typeof payload.user_id !== "string" ||
      !uuidPattern.test(payload.user_id) ||
      payload.user_id !== config.userId ||
      typeof payload.locale !== "string" ||
      !locales.has(payload.locale) ||
      typeof payload.idempotent !== "boolean"
    ) {
      return fail("invalid_rpc_response", "Profile update returned an invalid response.");
    }

    return {
      ok: true,
      userId: payload.user_id,
      locale: payload.locale,
      idempotent: payload.idempotent,
      message: "Profile updated."
    };
  } catch {
    return fail("server_error", "Profile changes could not be saved safely.");
  }
}