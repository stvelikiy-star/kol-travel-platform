import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type {
  ClientLoyaltyReadResult,
  ClientLoyaltyTransaction
} from "@/lib/types/client-loyalty";

type LoyaltyRow = Record<string, unknown>;

export async function readClientLoyaltyFromSupabase(): Promise<ClientLoyaltyReadResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return unavailable();
  }

  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll: () => cookieStore.getAll(),
        // This read contour never writes session or application state.
        setAll: () => undefined
      }
    });
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      return unavailable();
    }

    const { data: account, error: accountError } = await supabase
      .from("loyalty_accounts")
      .select("*")
      .eq("user_id", authData.user.id)
      .limit(1)
      .maybeSingle();

    if (accountError) {
      return unavailable();
    }

    if (!account) {
      return { balance: 0, source: "supabase", status: "ready", transactions: [] };
    }

    const accountRow = account as LoyaltyRow;
    const accountId = firstString(accountRow.id);
    const balance = firstNumber(accountRow.balance, accountRow.points_balance, accountRow.points);

    if (firstString(accountRow.user_id) !== authData.user.id || !accountId || balance === null) {
      return unavailable();
    }

    const { data: transactions, error: transactionsError } = await supabase
      .from("loyalty_transactions")
      .select("*")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (transactionsError || !transactions) {
      return unavailable();
    }

    return {
      balance,
      source: "supabase",
      status: "ready",
      transactions: (transactions as LoyaltyRow[])
        .map((row) => toTransaction(row, accountId))
        .filter((item): item is ClientLoyaltyTransaction => item !== null)
    };
  } catch {
    return unavailable();
  }
}

function unavailable(): ClientLoyaltyReadResult {
  return { balance: null, source: "supabase", status: "unavailable", transactions: [] };
}

function toTransaction(row: LoyaltyRow, accountId: string): ClientLoyaltyTransaction | null {
  if (firstString(row.account_id) !== accountId) {
    return null;
  }

  const id = firstString(row.id);
  const points = firstNumber(row.points, row.amount, row.points_delta);
  const createdAt = firstString(row.created_at);

  if (!id || points === null || !createdAt) {
    return null;
  }

  const kind = firstString(row.kind, row.type, row.transaction_type) ?? "loyalty";

  return {
    date: formatDate(createdAt),
    id,
    kind,
    points,
    title: firstString(row.title, row.description) ?? transactionTitle(kind)
  };
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return null;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("ru-RU").format(date);
}

function transactionTitle(kind: string): string {
  switch (kind.toLowerCase()) {
    case "earn":
    case "credit":
    case "accrual":
      return "Начисление баллов";
    case "redeem":
    case "debit":
    case "spend":
      return "Списание баллов";
    default:
      return "Операция loyalty";
  }
}
