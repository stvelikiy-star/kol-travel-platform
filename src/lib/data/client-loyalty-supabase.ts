import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireClient } from "@/lib/auth/roles";

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
    const [{ data: authData, error: authError }, client] = await Promise.all([
      supabase.auth.getUser(),
      requireClient()
    ]);

    if (
      authError ||
      !authData.user ||
      !client.ok ||
      !client.data.clientId ||
      authData.user.id !== client.data.userId ||
      authData.user.id !== client.data.clientId
    ) {
      return unavailable();
    }

    const clientId = client.data.clientId;

    const { data: accounts, error: accountError } = await supabase
      .from("loyalty_accounts")
      .select("*")
      .eq("user_id", clientId)
      .limit(2);

    if (accountError || !Array.isArray(accounts)) {
      return unavailable();
    }

    if (accounts.length !== 1) {
      return unavailable();
    }

    const accountRow = accounts[0] as LoyaltyRow;
    const accountId = firstString(accountRow.id);
    const balance = firstNumber(accountRow.balance, accountRow.points_balance, accountRow.points);

    if (accountRow.user_id !== clientId || !accountId || balance === null) {
      return unavailable();
    }

    const { data: transactions, error: transactionsError } = await supabase
      .from("loyalty_transactions")
      .select("*")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (transactionsError || !Array.isArray(transactions)) {
      return unavailable();
    }

    const mappedTransactions = (transactions as LoyaltyRow[]).map((row) => toTransaction(row, accountId));
    const transactionIds = mappedTransactions.map((transaction) => transaction?.id);

    if (
      mappedTransactions.some((transaction) => transaction === null) ||
      new Set(transactionIds).size !== transactionIds.length
    ) {
      return unavailable();
    }

    return {
      balance,
      source: "supabase",
      status: "ready",
      transactions: mappedTransactions as ClientLoyaltyTransaction[]
    };
  } catch {
    return unavailable();
  }
}

function unavailable(): ClientLoyaltyReadResult {
  return { balance: null, source: "supabase", status: "unavailable", transactions: [] };
}

function toTransaction(row: LoyaltyRow, accountId: string): ClientLoyaltyTransaction | null {
  if (row.account_id !== accountId) {
    return null;
  }

  const id = firstString(row.id);
  const points = firstNumber(row.points, row.amount, row.points_delta);
  const createdAt = firstString(row.created_at);

  if (!id || points === null || !createdAt || !isValidTimestamp(createdAt)) {
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

function isValidTimestamp(value: string): boolean {
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
