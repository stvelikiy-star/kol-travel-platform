import {
  getAuthenticatedRestConfig,
  getAuthenticatedRestHeaders
} from "@/lib/data/authenticated-read-utils";

export type ClientSupportTicket = {
  id: string;
  category: string;
  priority: string;
  status: string;
  title: string | null;
  relatedOrderId: string | null;
  relatedBookingId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ClientSupportReadResult = {
  ok: boolean;
  tickets: ClientSupportTicket[];
  code?: "supabase_not_configured" | "read_failed" | "server_error";
};

export type ClientSupportCreateInput = {
  category: string;
  title: string;
  message: string;
  requestId: string;
  relatedOrderId?: string | null;
  relatedBookingId?: string | null;
};

export type ClientSupportWriteResult = {
  ok: boolean;
  ticketId?: string;
  status?: string;
  idempotent?: boolean;
  code?: string;
  message: string;
};

type RawTicket = {
  id?: unknown;
  category?: unknown;
  priority?: unknown;
  status?: unknown;
  title?: unknown;
  related_order_id?: unknown;
  related_booking_id?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
};

type RawCreateResult = {
  ok?: unknown;
  ticket_id?: unknown;
  status?: unknown;
  idempotent?: unknown;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const categoryPattern = /^[a-z][a-z0-9_]{1,31}$/;

function fail(code: string, message: string): ClientSupportWriteResult {
  return { ok: false, code, message };
}

function normalizeOptionalUuid(value: string | null | undefined): string | null | undefined {
  if (value === null || value === undefined || value === "") return null;
  return uuidPattern.test(value) ? value : undefined;
}

function parseTicket(value: RawTicket): ClientSupportTicket | null {
  if (
    typeof value.id !== "string" ||
    !uuidPattern.test(value.id) ||
    typeof value.category !== "string" ||
    typeof value.priority !== "string" ||
    typeof value.status !== "string" ||
    typeof value.created_at !== "string" ||
    typeof value.updated_at !== "string"
  ) {
    return null;
  }

  return {
    id: value.id,
    category: value.category,
    priority: value.priority,
    status: value.status,
    title: typeof value.title === "string" ? value.title : null,
    relatedOrderId: typeof value.related_order_id === "string" ? value.related_order_id : null,
    relatedBookingId: typeof value.related_booking_id === "string" ? value.related_booking_id : null,
    createdAt: value.created_at,
    updatedAt: value.updated_at
  };
}

export async function getClientSupportTicketsFromSupabase(): Promise<ClientSupportReadResult> {
  const config = await getAuthenticatedRestConfig();
  if (!config) return { ok: false, tickets: [], code: "supabase_not_configured" };

  try {
    const url = new URL(`${config.restUrl}/support_tickets`);
    url.searchParams.set(
      "select",
      "id,category,priority,status,title,related_order_id,related_booking_id,created_at,updated_at"
    );
    url.searchParams.set("order", "created_at.desc");
    url.searchParams.set("limit", "50");

    const response = await fetch(url, {
      cache: "no-store",
      headers: getAuthenticatedRestHeaders(config)
    });
    if (!response.ok) return { ok: false, tickets: [], code: "read_failed" };

    const body: unknown = await response.json();
    if (!Array.isArray(body)) return { ok: false, tickets: [], code: "read_failed" };

    const tickets = body
      .map((row) => parseTicket((row ?? {}) as RawTicket))
      .filter((ticket): ticket is ClientSupportTicket => ticket !== null);

    if (tickets.length !== body.length) {
      return { ok: false, tickets: [], code: "read_failed" };
    }

    return { ok: true, tickets };
  } catch {
    return { ok: false, tickets: [], code: "server_error" };
  }
}

export async function createClientSupportTicketFromSupabase(
  input: ClientSupportCreateInput
): Promise<ClientSupportWriteResult> {
  const category = input.category.trim().toLowerCase();
  const title = input.title.trim();
  const message = input.message.trim();
  const requestId = input.requestId.trim();
  const relatedOrderId = normalizeOptionalUuid(input.relatedOrderId);
  const relatedBookingId = normalizeOptionalUuid(input.relatedBookingId);

  if (!categoryPattern.test(category)) return fail("invalid_category", "Support category is invalid.");
  if (title.length < 3 || title.length > 160) return fail("invalid_title", "Support title is invalid.");
  if (message.length < 3 || message.length > 4000) return fail("invalid_message", "Support message is invalid.");
  if (requestId.length < 8 || requestId.length > 128) return fail("invalid_request_id", "Support request id is invalid.");
  if (relatedOrderId === undefined || relatedBookingId === undefined) return fail("invalid_reference", "Support reference is invalid.");
  if (relatedOrderId && relatedBookingId) return fail("ambiguous_reference", "Support request may reference either an order or a booking, not both.");

  const config = await getAuthenticatedRestConfig();
  if (!config) return fail("supabase_not_configured", "Supabase support write is not configured.");

  try {
    const response = await fetch(`${config.restUrl}/rpc/client_support_ticket_create_atomic`, {
      method: "POST",
      headers: {
        ...getAuthenticatedRestHeaders(config),
        "content-type": "application/json"
      },
      cache: "no-store",
      body: JSON.stringify({
        p_category: category,
        p_title: title,
        p_message: message,
        p_request_id: requestId,
        p_related_order_id: relatedOrderId,
        p_related_booking_id: relatedBookingId
      })
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return fail("not_authorized", "Active client access is required.");
      }
      if ([400, 409, 422].includes(response.status)) {
        return fail("support_rejected", "Support request could not be created with the supplied data.");
      }
      return fail("support_rpc_failed", "Support request could not be created safely.");
    }

    const payload = (await response.json()) as RawCreateResult;
    if (
      payload.ok !== true ||
      typeof payload.ticket_id !== "string" ||
      !uuidPattern.test(payload.ticket_id) ||
      typeof payload.status !== "string"
    ) {
      return fail("invalid_rpc_response", "Support request returned an invalid response.");
    }

    return {
      ok: true,
      ticketId: payload.ticket_id,
      status: payload.status,
      idempotent: payload.idempotent === true,
      message: "Support request created."
    };
  } catch {
    return fail("server_error", "Support request could not be created safely.");
  }
}