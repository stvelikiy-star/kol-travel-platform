import "server-only";
import {requireRole} from "@/lib/auth/roles";
import {getAuthenticatedPartnerReadContext} from "@/lib/data/authenticated-read-utils";
import {isSupabaseMode} from "@/lib/data/data-source";
import {createSupabaseServiceRoleClient} from "@/lib/supabase/service-role";
import type {FinancePeriod} from "@/lib/finance/analytics";

export type OperationsAnalytics={
 schema_version:1;kind:"operational_not_financial";
 business_id:string|null;period_from:string;period_to_exclusive:string;timezone:"Asia/Bishkek";
 orders:{count:number;completed:number;cancelled:number;submitted_value_kgs:number;
   by_status:Record<string,number>;by_service:Record<string,number>};
 bookings:{count:number;completed:number;cancelled:number;by_status:Record<string,number>;
   by_service:Record<string,number>};
 clients:{unique_in_period:number;repeat_in_period:number;repeat_percentage_in_period:number|null};
 deliveries:{count:number;high_risk:number;by_status:Record<string,number>;sla_minutes:null};
 support:{count:number;by_status:Record<string,number>};
 daily:Array<{date:string;orders:number;bookings:number;completed_orders:number;completed_bookings:number}>;
 hourly_created_operations:Array<{hour:number;count:number}>;
 traffic_visits:null;conversion_rate:null;marketing_attribution:null;
 paid_revenue:null;profit:null;warning:string;
};
type ReadResult={ok:true;data:OperationsAnalytics}|{ok:false;code:"not_authorized"|"invalid_period"|"unavailable"};
function valid(p:FinancePeriod):boolean{
 if(!p||!/^\d{4}-\d{2}-\d{2}$/.test(p.from)||!/^\d{4}-\d{2}-\d{2}$/.test(p.toExclusive))return false;
 const a=new Date(p.from+"T00:00:00Z"),b=new Date(p.toExclusive+"T00:00:00Z");
 return Number.isFinite(a.valueOf())&&Number.isFinite(b.valueOf())&&
  a.toISOString().slice(0,10)===p.from&&b.toISOString().slice(0,10)===p.toExclusive&&
  b.getTime()>a.getTime()&&b.valueOf()-a.valueOf()<=366*86400000;
}
async function read(p:FinancePeriod,businessId:string|null):Promise<ReadResult>{
 if(!valid(p))return {ok:false,code:"invalid_period"};
 if(!isSupabaseMode())return {ok:false,code:"unavailable"};
 try{
  const db=createSupabaseServiceRoleClient();
  const {data,error}=await db.rpc("kol_operations_analytics_v1",{
   p_from:p.from,p_to:p.toExclusive,p_business_id:businessId
  });
  if(error||!data||typeof data!=="object"||Array.isArray(data))return {ok:false,code:"unavailable"};
  const d=data as Record<string,unknown>;
  if(d.schema_version!==1||d.kind!=="operational_not_financial"||
   d.business_id!==businessId||d.period_from!==p.from||d.period_to_exclusive!==p.toExclusive||
   !d.orders||!d.bookings||!d.clients||!Array.isArray(d.daily)||
   !Array.isArray(d.hourly_created_operations)||d.conversion_rate!==null||d.profit!==null)
   return {ok:false,code:"unavailable"};
  return {ok:true,data:data as OperationsAnalytics};
 }catch{return {ok:false,code:"unavailable"};}
}
export async function readOwnerOperationsAnalytics(p:FinancePeriod):Promise<ReadResult>{
 const actor=await requireRole(["super_admin"]);
 if(!actor.ok)return {ok:false,code:"not_authorized"};
 return read(p,null);
}
export async function readPartnerOperationsAnalytics(p:FinancePeriod):Promise<ReadResult>{
 const actor=await requireRole(["partner_owner","partner_manager"]);
 if(!actor.ok||!actor.data.partnerId)return {ok:false,code:"not_authorized"};
 const ctx=await getAuthenticatedPartnerReadContext();
 if(!ctx||ctx.rest.userId!==actor.data.userId||ctx.businessId!==actor.data.partnerId)
  return {ok:false,code:"not_authorized"};
 return read(p,ctx.businessId);
}
