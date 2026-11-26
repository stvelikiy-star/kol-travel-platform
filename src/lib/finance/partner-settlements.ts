import "server-only";
import {requireRole} from "@/lib/auth/roles";
import {isSupabaseMode} from "@/lib/data/data-source";
import {getAuthenticatedPartnerReadContext} from "@/lib/data/authenticated-read-utils";
import {createSupabaseServiceRoleClient} from "@/lib/supabase/service-role";

type Balance={currency:string;kind:"payout"|"collection";obligation:number;recorded:number;remaining:number;excess:number};
export async function readPartnerSettlementBalances():Promise<Balance[]|null>{
 const actor=await requireRole(["partner_owner","partner_manager"]);
 if(!actor.ok||!actor.data.partnerId||!isSupabaseMode())return null;
 const context=await getAuthenticatedPartnerReadContext();
 if(!context||context.rest.userId!==actor.data.userId||context.businessId!==actor.data.partnerId)return null;
 try{
  const {data,error}=await createSupabaseServiceRoleClient().rpc("kol_settlement_evidence_report_v1",{p_business_id:context.businessId});
  if(error||data?.kind!=="owner_attested_settlement_evidence"||data.business_id!==context.businessId||data.bank_verified!==false||data.money_transferred!==false||!Array.isArray(data.by_currency))return null;
  if(!data.by_currency.every((x:Balance)=>x&&typeof x.currency==="string"&&/^[A-Z]{3}$/.test(x.currency)&&(x.kind==="payout"||x.kind==="collection")&&[x.obligation,x.recorded,x.remaining,x.excess].every(Number.isFinite)))return null;
  return data.by_currency.map((x:Balance)=>({currency:x.currency,kind:x.kind,obligation:x.obligation,recorded:x.recorded,remaining:x.remaining,excess:x.excess}));
 }catch{return null;}
}
