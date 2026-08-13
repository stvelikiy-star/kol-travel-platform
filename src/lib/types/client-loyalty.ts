export interface ClientLoyaltyTransaction {
  date: string;
  id: string;
  kind: string;
  points: number;
  title: string;
}

export interface ClientLoyaltyReadResult {
  balance: number | null;
  source: "mock" | "supabase";
  status: "ready" | "unavailable";
  transactions: ClientLoyaltyTransaction[];
}
