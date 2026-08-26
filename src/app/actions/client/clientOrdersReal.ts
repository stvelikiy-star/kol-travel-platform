"use server";

import { requireClient } from "@/lib/auth/roles";
import {
  createAtomicOrderFromSupabase,
  type AtomicOrderItemInput
} from "@/lib/data/order-write-supabase";

type CreateOrderActionInput = {
  businessId: string;
  orderType: "food" | "shop";
  items: AtomicOrderItemInput[];
  deliveryMethod: "pickup";
  idempotencyKey: string;
};

type CreateOrderActionResult = {
  ok: boolean;
  orderId?: string;
  code?: string;
  message: string;
};

export async function createOrderRealAction(
  input: CreateOrderActionInput
): Promise<CreateOrderActionResult> {
  const client = await requireClient();

  if (!client.ok) {
    return {
      ok: false,
      code: "not_authorized",
      message: "Active client access is required."
    };
  }

  // Identity and all monetary values are intentionally absent from the input.
  // The PostgreSQL RPC derives client identity from auth.uid() and prices from
  // locked catalog rows. Delivery remains pickup-only until a DB fee model exists.
  return createAtomicOrderFromSupabase(input);
}
