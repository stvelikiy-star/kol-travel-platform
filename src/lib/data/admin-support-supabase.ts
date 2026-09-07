import { requireAdmin } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AdminSupportMessage = {
  id: string;
  ticketId: string;
  senderId: string | null;
  message: string;
  createdAt: string;
};

export type AdminSupportTicket = {
  id: string;
  createdBy: string | null;
  category: string;
  priority: string;
  status: string;
  title: string | null;
  relatedOrderId: string | null;
  relatedBookingId: string | null;
  createdAt: string;
  updatedAt: string;
  messages: AdminSupportMessage[];
};

export type AdminSupportReadResult = {
  ok: boolean;
  tickets: AdminSupportTicket[];
  code?: "not_authorized" | "supabase_not_configured" | "read_failed" | "server_error";
};

type RawTicket = {
  id?: unknown;
  created_by?: unknown;
  category?: unknown;
  priority?: unknown;
  status?: unknown;
  title?: unknown;
  related_order_id?: unknown;
  related_booking_id?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
};

type RawMessage = {
  id?: unknown;
  ticket_id?: unknown;
  sender_id?: unknown;
  message?: unknown;
  visibility?: unknown;
  created_at?: unknown;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseTicket(value: RawTicket): Omit<AdminSupportTicket, "messages"> | null {
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
    createdBy: typeof value.created_by === "string" ? value.created_by : null,
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

function parseMessage(value: RawMessage): AdminSupportMessage | null {
  if (
    typeof value.id !== "string" ||
    !uuidPattern.test(value.id) ||
    typeof value.ticket_id !== "string" ||
    !uuidPattern.test(value.ticket_id) ||
    typeof value.message !== "string" ||
    value.visibility !== "public" ||
    typeof value.created_at !== "string"
  ) {
    return null;
  }

  return {
    id: value.id,
    ticketId: value.ticket_id,
    senderId: typeof value.sender_id === "string" ? value.sender_id : null,
    message: value.message,
    createdAt: value.created_at
  };
}

export async function getAdminSupportTicketsFromSupabase(): Promise<AdminSupportReadResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return { ok: false, tickets: [], code: "not_authorized" };

  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, tickets: [], code: "supabase_not_configured" };

    const { data, error } = await supabase
      .from("support_tickets")
      .select("id,created_by,category,priority,status,title,related_order_id,related_booking_id,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error || !Array.isArray(data)) {
      return { ok: false, tickets: [], code: "read_failed" };
    }

    const baseTickets = data
      .map((row) => parseTicket((row ?? {}) as RawTicket))
      .filter((ticket): ticket is Omit<AdminSupportTicket, "messages"> => ticket !== null);

    if (baseTickets.length !== data.length) return { ok: false, tickets: [], code: "read_failed" };
    if (baseTickets.length === 0) return { ok: true, tickets: [] };

    const ticketIds = baseTickets.map((ticket) => ticket.id);
    const { data: messageRows, error: messageError } = await supabase
      .from("ticket_messages")
      .select("id,ticket_id,sender_id,message,visibility,created_at")
      .in("ticket_id", ticketIds)
      .eq("visibility", "public")
      .order("created_at", { ascending: true })
      .limit(1000);

    if (messageError || !Array.isArray(messageRows)) {
      return { ok: false, tickets: [], code: "read_failed" };
    }

    const messages = messageRows
      .map((row) => parseMessage((row ?? {}) as RawMessage))
      .filter((message): message is AdminSupportMessage => message !== null);
    if (messages.length !== messageRows.length) return { ok: false, tickets: [], code: "read_failed" };

    const messagesByTicket = new Map<string, AdminSupportMessage[]>();
    for (const message of messages) {
      const bucket = messagesByTicket.get(message.ticketId) ?? [];
      bucket.push(message);
      messagesByTicket.set(message.ticketId, bucket);
    }

    return {
      ok: true,
      tickets: baseTickets.map((ticket) => ({
        ...ticket,
        messages: messagesByTicket.get(ticket.id) ?? []
      }))
    };
  } catch {
    return { ok: false, tickets: [], code: "server_error" };
  }
}