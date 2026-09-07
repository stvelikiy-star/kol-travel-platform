import { requireAdmin } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseTicket(value: RawTicket): AdminSupportTicket | null {
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

    const tickets = data
      .map((row) => parseTicket((row ?? {}) as RawTicket))
      .filter((ticket): ticket is AdminSupportTicket => ticket !== null);

    if (tickets.length !== data.length) return { ok: false, tickets: [], code: "read_failed" };
    return { ok: true, tickets };
  } catch {
    return { ok: false, tickets: [], code: "server_error" };
  }
}