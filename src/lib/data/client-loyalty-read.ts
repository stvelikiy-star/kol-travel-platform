import { readClientLoyaltyFromSupabase } from "@/lib/data/client-loyalty-supabase";
import type { ClientLoyaltyReadResult } from "@/lib/types/client-loyalty";

const mockHistory = [
  { id: "mock-order", title: "Начисление за завершённый заказ", points: 88, date: "18.06.2026", kind: "order" },
  { id: "mock-booking", title: "Бонус за бронь тура", points: 250, date: "17.06.2026", kind: "booking" },
  { id: "mock-promo", title: "Списание на скидку", points: -120, date: "16.06.2026", kind: "promo" }
];

export async function readClientLoyalty(): Promise<ClientLoyaltyReadResult> {
  if (process.env.DATA_SOURCE_MODE === "supabase") {
    return readClientLoyaltyFromSupabase();
  }

  return {
    balance: 1240,
    source: "mock",
    status: "ready",
    transactions: mockHistory
  };
}
