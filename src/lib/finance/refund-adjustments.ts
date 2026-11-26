import "server-only";
import {getAuthenticatedPartnerReadContext} from "@/lib/data/authenticated-read-utils";
import {requireRole} from "@/lib/auth/roles";
import {isSupabaseMode} from "@/lib/data/data-source";
import {createSupabaseServiceRoleClient} from "@/lib/supabase/service-role";
import type {FinancePeriod} from "@/lib/finance/analytics";
type Row={currency:string;gross_reduction:number;fee_reduction:number};
export async function readRefundAdjustmentPeriod(period:FinancePeriod):Promise<Row[]|null>{
 const actor=await requireRole(["super_admin","finance_admin"]);
 if(!actor.ok||!isSupabaseMode())return null;
 return readScoped(period,null);
}
async function readScoped(period:FinancePeriod,businessId:string|null):Promise<Row[]|null>{
 try{
  const {data,error}=await createSupabaseServiceRoleClient().rpc("kol_refund_adjustment_period_v1",{p_from:period.from,p_to:period.toExclusive,p_business_id:businessId});
  if(error||data?.kind!=="owner_attested_refund_period"||data.business_id!==businessId||data.period_from!==period.from||data.period_to_exclusive!==period.toExclusive||!Array.isArray(data.by_currency)||
   !data.by_currency.every((x:Row)=>x&&typeof x.currency==="string"&&/^[A-Z]{3}$/.test(x.currency)&&Number.isFinite(x.gross_reduction)&&Number.isFinite(x.fee_reduction)))return null;
  return data.by_currency;
 }catch{return null;}
}

export async function readPartnerRefundAdjustmentPeriod(period:FinancePeriod):Promise<Row[]|null>{
 const actor=await requireRole(["partner_owner","partner_manager"]);
 if(!actor.ok||!actor.data.partnerId||!isSupabaseMode())return null;
 const context=await getAuthenticatedPartnerReadContext();
 if(!context||context.rest.userId!==actor.data.userId||context.businessId!==actor.data.partnerId)return null;
 return readScoped(period,context.businessId);
}
