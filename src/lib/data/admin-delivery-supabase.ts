import { requireAdmin } from "@/lib/auth/roles";
import type {
  AdminCourierOption,
  AdminOperationalDeliveryOrder,
  AdminOperationalDeliveryReadResult
} from "@/lib/data/admin-delivery-operational-types";
import type { SupabaseAdminDeliveryOrderRow } from "@/lib/data/types";
import { getAuthenticatedRestConfig, getAuthenticatedRestHeaders } from "@/lib/data/authenticated-read-utils";

const adminDeliveryFields = [
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
  "partners(title)"
].join(",");

const activeCourierStatuses = new Set(["online", "available"]);

type SupabaseAdminDeliveryRow = {
  id: string;
  order_id: string | null;
  assigned_courier_id: string | null;
  status: string | null;
};

type SupabaseCourierProfileRow = {
  user_id: string;
  availability_status: string | null;
  vehicle_type: string | null;
  vehicle_number: string | null;
  working_zone: string | null;
};

type SupabaseUserProfileRow = {
  user_id: string;
  full_name: string | null;
  email: string | null;
};

function createAdminDeliverySupabaseResult(input: {
  ok: boolean;
  orders?: AdminOperationalDeliveryOrder[];
  couriers?: AdminCourierOption[];
  code?: AdminOperationalDeliveryReadResult["code"];
  message?: string;
}): AdminOperationalDeliveryReadResult {
  return {
    ok: input.ok,
    source: "supabase",
    orders: input.orders ?? [],
    couriers: input.couriers ?? [],
    code: input.code,
    message: input.message
  };
}

function toNumber(value: number | string | null | undefined) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function createInFilter(values: string[]) {
  const quotedValues = values.map((value) => {
    const escapedValue = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `"${escapedValue}"`;
  });
  return `in.(${quotedValues.join(",")})`;
}

function mapAdminDeliveryOrder(
  row: SupabaseAdminDeliveryOrderRow,
  deliveryByOrderId: Map<string, SupabaseAdminDeliveryRow>
): AdminOperationalDeliveryOrder {
  const delivery = deliveryByOrderId.get(row.id);
  return {
    id: row.id,
    clientId: row.client_id,
    businessId: row.business_id,
    partnerTitle: row.partners?.title ?? undefined,
    type: row.type,
    status: row.status,
    paymentStatus: row.payment_status,
    subtotal: toNumber(row.subtotal),
    deliveryFee: toNumber(row.delivery_fee),
    discount: toNumber(row.discount),
    total: toNumber(row.total),
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deliveryId: delivery?.id,
    deliveryStatus: delivery?.status?.trim() || undefined,
    assignedCourierId: delivery?.assigned_courier_id?.trim() || undefined
  };
}

async function readAvailableCouriers(config: NonNullable<Awaited<ReturnType<typeof getAuthenticatedRestConfig>>>) {
  const courierUrl = new URL(`${config.restUrl}/courier_profiles`);
  courierUrl.searchParams.set("select", "user_id,availability_status,vehicle_type,vehicle_number,working_zone");
  courierUrl.searchParams.set("availability_status", "in.(online,available)");
  courierUrl.searchParams.set("order", "updated_at.desc");

  const courierResponse = await fetch(courierUrl.toString(), {
    method: "GET",
    headers: getAuthenticatedRestHeaders(config),
    cache: "no-store"
  });
  if (!courierResponse.ok) throw new Error("courier_profiles_read_failed");

  const courierRows = (await courierResponse.json()) as SupabaseCourierProfileRow[];
  const eligibleRows = courierRows.filter((row) => row.user_id && activeCourierStatuses.has(row.availability_status ?? ""));
  if (eligibleRows.length === 0) return [];

  const profileUrl = new URL(`${config.restUrl}/user_profiles`);
  profileUrl.searchParams.set("select", "user_id,full_name,email");
  profileUrl.searchParams.set("user_id", createInFilter(eligibleRows.map((row) => row.user_id)));

  const profileResponse = await fetch(profileUrl.toString(), {
    method: "GET",
    headers: getAuthenticatedRestHeaders(config),
    cache: "no-store"
  });
  if (!profileResponse.ok) throw new Error("courier_user_profiles_read_failed");

  const profileRows = (await profileResponse.json()) as SupabaseUserProfileRow[];
  const profileByUserId = new Map(profileRows.map((row) => [row.user_id, row]));

  return eligibleRows.map((row): AdminCourierOption => {
    const profile = profileByUserId.get(row.user_id);
    return {
      userId: row.user_id,
      fullName: profile?.full_name?.trim() || undefined,
      email: profile?.email?.trim() || undefined,
      availabilityStatus: row.availability_status ?? "online",
      vehicleType: row.vehicle_type?.trim() || undefined,
      vehicleNumber: row.vehicle_number?.trim() || undefined,
      workingZone: row.working_zone?.trim() || undefined
    };
  });
}

export async function getAdminDeliveryOrdersFromSupabase(): Promise<AdminOperationalDeliveryReadResult> {
  const [config, admin] = await Promise.all([getAuthenticatedRestConfig(), requireAdmin()]);

  if (!config) {
    return createAdminDeliverySupabaseResult({
      ok: false,
      code: "supabase_not_configured",
      message: "Supabase read environment is not configured."
    });
  }

  if (!admin.ok || config.userId !== admin.data.userId) {
    return createAdminDeliverySupabaseResult({
      ok: false,
      code: "read_failed",
      message: "Admin delivery data is not available for this authenticated identity."
    });
  }

  try {
    const ordersUrl = new URL(`${config.restUrl}/orders`);
    ordersUrl.searchParams.set("select", adminDeliveryFields);
    ordersUrl.searchParams.set("order", "updated_at.desc");

    const ordersResponse = await fetch(ordersUrl.toString(), {
      method: "GET",
      headers: getAuthenticatedRestHeaders(config),
      cache: "no-store"
    });
    if (!ordersResponse.ok) {
      return createAdminDeliverySupabaseResult({ ok: false, code: "read_failed", message: "Admin delivery orders could not be read safely." });
    }

    const orderRows = (await ordersResponse.json()) as SupabaseAdminDeliveryOrderRow[];
    const orderIds = orderRows.map((row) => row.id);
    const deliveryByOrderId = new Map<string, SupabaseAdminDeliveryRow>();

    if (orderIds.length > 0) {
      const deliveriesUrl = new URL(`${config.restUrl}/deliveries`);
      deliveriesUrl.searchParams.set("select", "id,order_id,assigned_courier_id,status");
      deliveriesUrl.searchParams.set("order_id", createInFilter(orderIds));

      const deliveriesResponse = await fetch(deliveriesUrl.toString(), {
        method: "GET",
        headers: getAuthenticatedRestHeaders(config),
        cache: "no-store"
      });
      if (!deliveriesResponse.ok) {
        return createAdminDeliverySupabaseResult({ ok: false, code: "read_failed", message: "Admin delivery state could not be read safely." });
      }

      const deliveryRows = (await deliveriesResponse.json()) as SupabaseAdminDeliveryRow[];
      for (const delivery of deliveryRows) {
        const orderId = delivery.order_id?.trim();
        if (orderId) deliveryByOrderId.set(orderId, delivery);
      }
    }

    const couriers = await readAvailableCouriers(config);
    const orders = orderRows.map((row) => mapAdminDeliveryOrder(row, deliveryByOrderId));

    if (orders.length === 0) {
      return createAdminDeliverySupabaseResult({
        ok: false,
        orders,
        couriers,
        code: "empty_result",
        message: "No Supabase admin delivery orders were found."
      });
    }

    return createAdminDeliverySupabaseResult({
      ok: true,
      orders,
      couriers,
      message: "Admin delivery orders, delivery state and eligible couriers read from Supabase."
    });
  } catch {
    return createAdminDeliverySupabaseResult({
      ok: false,
      code: "server_error",
      message: "Admin delivery operational read failed safely."
    });
  }
}
