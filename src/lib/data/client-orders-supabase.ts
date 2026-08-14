import { requireClient } from "@/lib/auth/roles";
import { getAuthenticatedRestConfig, getAuthenticatedRestHeaders } from "@/lib/data/authenticated-read-utils";
import type { ClientOrderReadItem, ClientOrdersReadResult, SupabaseClientOrderRow } from "@/lib/data/types";

const clientOrderFields = [
  "id",
  "client_id",
  "business_id",
  "type",
  "status",
  "payment_status",
  "subtotal",
  "delivery_fee",
  "discount",
  "total",
  "metadata",
  "created_at",
  "updated_at",
  "partners(title,slug)"
].join(",");

function createClientOrdersSupabaseResult(input: {
  ok: boolean;
  orders?: ClientOrderReadItem[];
  code?: ClientOrdersReadResult["code"];
  message?: string;
}): ClientOrdersReadResult {
  return {
    ok: input.ok,
    source: "supabase",
    orders: input.orders ?? [],
    code: input.code,
    message: input.message
  };
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidTimestamp(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|([+-])(\d{2}):(\d{2}))$/.exec(value);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = match[8] === undefined ? 0 : Number(match[8]);
  const offsetMinute = match[9] === undefined ? 0 : Number(match[9]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  return (
    year > 0 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth[month - 1] &&
    hour <= 23 &&
    minute <= 59 &&
    second <= 59 &&
    offsetHour <= 23 &&
    offsetMinute <= 59 &&
    Number.isFinite(Date.parse(value))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mapClientOrder(row: unknown, clientId: string): ClientOrderReadItem | null {
  if (!isRecord(row) || row.client_id !== clientId) {
    return null;
  }

  const subtotal = toNumber(row.subtotal);
  const deliveryFee = toNumber(row.delivery_fee);
  const discount = toNumber(row.discount);
  const total = toNumber(row.total);
  const metadata = row.metadata === null ? {} : row.metadata;
  const partner = row.partners;

  if (
    !isNonEmptyString(row.id) ||
    !isNonEmptyString(row.business_id) ||
    !isNonEmptyString(row.type) ||
    !isNonEmptyString(row.status) ||
    !isNonEmptyString(row.payment_status) ||
    !isValidTimestamp(row.created_at) ||
    !isValidTimestamp(row.updated_at) ||
    subtotal === null ||
    deliveryFee === null ||
    discount === null ||
    total === null ||
    !isRecord(metadata) ||
    (partner !== null && partner !== undefined && !isRecord(partner))
  ) {
    return null;
  }

  const partnerRow = isRecord(partner) ? partner : null;

  return {
    id: row.id,
    clientId: row.client_id,
    businessId: row.business_id,
    partnerTitle: isNonEmptyString(partnerRow?.title) ? partnerRow.title : undefined,
    partnerSlug: isNonEmptyString(partnerRow?.slug) ? partnerRow.slug : undefined,
    type: row.type,
    status: row.status,
    paymentStatus: row.payment_status,
    subtotal,
    deliveryFee,
    discount,
    total,
    metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function getClientOrdersFromSupabase(): Promise<ClientOrdersReadResult> {
  try {
    const [config, client] = await Promise.all([getAuthenticatedRestConfig(), requireClient()]);

    if (!config) {
      return createClientOrdersSupabaseResult({
        ok: false,
        code: "supabase_not_configured",
        message: "Supabase read environment is not configured."
      });
    }

    if (!client.ok) {
      return createClientOrdersSupabaseResult({
        ok: false,
        code: "read_failed",
        message: "Client orders are not available for this authenticated role."
      });
    }

    const clientId = client.data.clientId;

    if (!isNonEmptyString(clientId) || config.userId !== client.data.userId || config.userId !== clientId) {
      return createClientOrdersSupabaseResult({
        ok: false,
        code: "read_failed",
        message: "Client orders are not available for this authenticated identity."
      });
    }

    const authenticatedClientId: string = clientId;

    const url = new URL(`${config.restUrl}/orders`);
    url.searchParams.set("client_id", `eq.${authenticatedClientId}`);
    url.searchParams.set("select", clientOrderFields);
    url.searchParams.set("order", "created_at.desc");

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: getAuthenticatedRestHeaders(config),
      cache: "no-store"
    });

    if (!response.ok) {
      return createClientOrdersSupabaseResult({
        ok: false,
        code: "read_failed",
        message: "Client orders could not be read safely."
      });
    }

    const payload: unknown = await response.json();

    if (!Array.isArray(payload)) {
      return createClientOrdersSupabaseResult({
        ok: false,
        code: "read_failed",
        message: "Client orders response was not valid."
      });
    }

    const rows = payload as SupabaseClientOrderRow[];
    const orders = rows.map((row) => mapClientOrder(row, authenticatedClientId));
    const orderIds = orders.map((order) => order?.id);

    if (
      orders.some((order) => order === null) ||
      new Set(orderIds).size !== orderIds.length
    ) {
      return createClientOrdersSupabaseResult({
        ok: false,
        code: "read_failed",
        message: "Client orders response was malformed or did not match the authenticated client."
      });
    }

    const validatedOrders = orders as ClientOrderReadItem[];

    if (validatedOrders.length === 0) {
      return createClientOrdersSupabaseResult({
        ok: false,
        orders: validatedOrders,
        code: "empty_result",
        message: "No Supabase client orders were found for the authenticated client."
      });
    }

    return createClientOrdersSupabaseResult({
      ok: true,
      orders: validatedOrders,
      message: "Client orders read from Supabase test data."
    });
  } catch {
    return createClientOrdersSupabaseResult({
      ok: false,
      code: "server_error",
      message: "Client orders read failed safely."
    });
  }
}
