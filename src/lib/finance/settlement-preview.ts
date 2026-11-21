import "server-only";

import {requireRole} from "@/lib/auth/roles";
import {getAuthenticatedPartnerReadContext} from "@/lib/data/authenticated-read-utils";
import {isSupabaseMode} from "@/lib/data/data-source";
import {createSupabaseServiceRoleClient} from "@/lib/supabase/service-role";
import type {FinancePeriod} from "@/lib/finance/analytics";

// This is only a projection: no booked revenue, bank settlement or payable is posted.
export type SettlementPreview = {
  schema_version: 1;
  kind: "non_posting_settlement_preview";
  period_from: string;
  period_to_exclusive: string;
  timezone: "Asia/Bishkek";
  business_id: string | null;
  counts: {
    subjects: number; completed: number; paid_rows: number; verified_paid_rows: number;
    preview_eligible: number; unverified_paid_subjects: number;
    duplicate_paid_subjects: number; refund_blocked: number;
    missing_terms: number; ambiguous_terms: number; overpriced_fee: number;
  };
  by_currency: Array<{
    currency: string; eligible_count: number; provider_verified_gross: number;
    provisional_platform_fee: number;
    provisional_partner_allocation_if_platform_collects: number;
    provisional_platform_receivable_if_partner_collects: number;
  }>;
  recognized_revenue: null;
  actual_partner_payable: null;
  actual_paid_payout: null;
  profit: null;
  posted_financial_transactions: 0;
  warning: string;
};
type Result = {ok: true; data: SettlementPreview}
  | {ok: false; code: "not_authorized"|"invalid_period"|"unavailable"};

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validPeriod(p: FinancePeriod): boolean {
  if(!p||!p.from||!p.toExclusive) return false;
  const parse=(s:string):number|null=>{
    if(!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const n=new Date(s+"T00:00:00.000Z");
    return Number.isFinite(n.valueOf()) && n.toISOString().slice(0,10)===s ? n.valueOf():null;
  };
  const a=parse(p.from), b=parse(p.toExclusive);
  return a!==null&&b!==null&&b>a&&b-a<=366*86_400_000;
}
async function readPreview(p:FinancePeriod,businessId:string|null):Promise<Result>{
  if(!validPeriod(p)) return {ok:false,code:"invalid_period"};
  if(!isSupabaseMode() || (businessId!==null&&!uuidRe.test(businessId)))
    return {ok:false,code:"unavailable"};
  try {
    const supabase=createSupabaseServiceRoleClient();
    const {data,error}=await supabase.rpc("kol_finance_settlement_preview_v1",{
      p_from:p.from,p_to:p.toExclusive,p_business_id:businessId
    });
    if(error||!data||typeof data!=="object"||Array.isArray(data)) return {ok:false,code:"unavailable"};
    const value=data as Record<string,unknown>;
    if(value.schema_version!==1||value.kind!=="non_posting_settlement_preview"||
       value.period_from!==p.from||value.period_to_exclusive!==p.toExclusive||
       value.business_id!==businessId||!value.counts||!Array.isArray(value.by_currency)||
       value.recognized_revenue!==null||value.actual_partner_payable!==null||
       value.actual_paid_payout!==null||value.profit!==null)
      return {ok:false,code:"unavailable"};
    return {ok:true,data:data as SettlementPreview};
  } catch {return {ok:false,code:"unavailable"};}
}
export async function readOwnerSettlementPreview(p:FinancePeriod):Promise<Result>{
  const actor=await requireRole(["super_admin"]);
  if(!actor.ok)return {ok:false,code:"not_authorized"};
  return readPreview(p,null);
}
export async function readFinanceAdminSettlementPreview(p:FinancePeriod):Promise<Result>{
  const actor=await requireRole(["super_admin","finance_admin"]);
  if(!actor.ok)return {ok:false,code:"not_authorized"};
  return readPreview(p,null);
}
export async function readPartnerSettlementPreview(p:FinancePeriod):Promise<Result>{
  const actor=await requireRole(["partner_owner","partner_manager"]);
  if(!actor.ok||!actor.data.partnerId)return {ok:false,code:"not_authorized"};
  const context=await getAuthenticatedPartnerReadContext();
  if(!context||context.rest.userId!==actor.data.userId||
     context.businessId!==actor.data.partnerId)return {ok:false,code:"not_authorized"};
  return readPreview(p,context.businessId);
}
