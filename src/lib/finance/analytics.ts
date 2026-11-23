import "server-only";

import { requireRole } from "@/lib/auth/roles";
import { getAuthenticatedPartnerReadContext } from "@/lib/data/authenticated-read-utils";
import { isSupabaseMode } from "@/lib/data/data-source";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

// Server-only analytics contract for Claude's OWNER/PARTNER UI; no UI modified.
export type FinancePeriod = { from: string; toExclusive: string };
export type FinanceSnapshot = {
  schema_version: 1;
  timezone: "Asia/Bishkek";
  period_from: string;
  period_to_exclusive: string;
  business_id: string | null;
  orders: { count: number; submitted_value_kgs: number; by_status: Record<string, number>; by_type: Record<string, number> };
  bookings: { count: number; submitted_value_by_currency: Array<{ currency: string; amount: number; count: number }>; by_status: Record<string, number> };
  payments: { attempts: number; recorded_paid_count: number; recorded_paid_by_currency: Array<{ currency: string; amount: number; count: number }>; duplicate_paid_subjects: number };
  refunds: { records: number; by_status: Record<string, number> };
  payouts: { records: number; by_status: Record<string, number> };
  commissions: { active_terms: number; earned_amount: null };
  daily: Array<{ date: string; orders: number; bookings: number; recorded_paid_payments: number }>;
  unconfirmed: string[];
};
export type FinanceReadResult =
  | { ok: true; source: "supabase"; data: FinanceSnapshot }
  | { ok: false; source: "supabase"; data: null; code: "unauthorized" | "invalid_period" | "unavailable" };

function fail(code: "unauthorized" | "invalid_period" | "unavailable"): FinanceReadResult {
  return { ok: false, source: "supabase", data: null, code };
}

function dateValue(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(value + "T00:00:00.000Z");
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value
    ? parsed.valueOf() : null;
}

function validPeriod(period: FinancePeriod): boolean {
  if (!period || typeof period !== "object") return false;
  const from = dateValue(period.from);
  const to = dateValue(period.toExclusive);
  return from !== null && to !== null && to > from && to - from <= 366 * 86_400_000;
}

function validSnapshot(value: unknown, expectedBusinessId: string | null, period: FinancePeriod): value is FinanceSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return row.schema_version === 1 && row.timezone === "Asia/Bishkek" &&
    row.period_from === period.from && row.period_to_exclusive === period.toExclusive &&
    row.business_id === expectedBusinessId && !!row.orders && !!row.bookings &&
    !!row.payments && !!row.refunds && !!row.payouts && !!row.commissions &&
    Array.isArray(row.daily) && Array.isArray(row.unconfirmed);
}

async function readScoped(period: FinancePeriod, businessId: string | null): Promise<FinanceReadResult> {
  if (!isSupabaseMode()) return fail("unavailable");
  if (!validPeriod(period)) return fail("invalid_period");
  try {
    const service = createSupabaseServiceRoleClient();
    const { data, error } = await service.rpc("kol_finance_analytics_v1", {
      p_from: period.from, p_to: period.toExclusive, p_business_id: businessId
    });
    if (error || !validSnapshot(data, businessId, period)) return fail("unavailable");
    return { ok: true, source: "supabase", data };
  } catch {
    return fail("unavailable");
  }
}

export async function readOwnerFinanceAnalytics(period: FinancePeriod): Promise<FinanceReadResult> {
  const identity = await requireRole(["super_admin"]);
  if (!identity.ok) return fail("unauthorized");
  return readScoped(period, null);
}

export async function readAdminFinanceAnalytics(period: FinancePeriod): Promise<FinanceReadResult> {
  const identity = await requireRole(["super_admin", "finance_admin"]);
  if (!identity.ok) return fail("unauthorized");
  return readScoped(period, null);
}

export async function readPartnerFinanceAnalytics(period: FinancePeriod): Promise<FinanceReadResult> {
  const identity = await requireRole(["partner_owner", "partner_manager"]);
  if (!identity.ok || !identity.data.partnerId) return fail("unauthorized");
  const context = await getAuthenticatedPartnerReadContext();
  if (!context || context.rest.userId !== identity.data.userId ||
      context.businessId !== identity.data.partnerId) return fail("unauthorized");
  // Never accept businessId from the browser: use the authenticated partner scope.
  return readScoped(period, context.businessId);
}
