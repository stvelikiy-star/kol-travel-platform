import "server-only";

import {requireClient,requireRole} from "@/lib/auth/roles";
import {isSupabaseMode} from "@/lib/data/data-source";
import {getAuthenticatedPartnerReadContext} from "@/lib/data/authenticated-read-utils";
import {createSupabaseServiceRoleClient} from "@/lib/supabase/service-role";

export type RefundSource={
 id:string;amount:number;status:string;created_at:string;subject_type:"order"|"booking";
};
export type PayoutSource={
 id:string;partner_allocation:number;currency:string;recognized_at:string;collection_model:string;
};
type ReadResult<T>={ok:true;rows:T[]}|{ok:false;code:"unauthorized"|"unavailable"};

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidId(v:unknown):v is string{return typeof v==="string"&&uuid.test(v);}
export async function readOwnRefundSources():Promise<ReadResult<RefundSource>>{
 const actor=await requireClient();
 if(!actor.ok||!actor.data.clientId)return {ok:false,code:"unauthorized"};
 if(!isSupabaseMode())return {ok:false,code:"unavailable"};
 try{
  const db=createSupabaseServiceRoleClient();
  const [orders,bookings]=await Promise.all([
    db.from("orders").select("id").eq("client_id",actor.data.clientId)
      .order("created_at",{ascending:false}).limit(100),
    db.from("bookings").select("id").eq("client_id",actor.data.clientId)
      .order("created_at",{ascending:false}).limit(100)
  ]);
  if(orders.error||bookings.error)return {ok:false,code:"unavailable"};
  const orderIds=(orders.data??[]).map(v=>v.id).filter(isValidId);
  const bookingIds=(bookings.data??[]).map(v=>v.id).filter(isValidId);
  const [paidOrders,paidBookings]=await Promise.all([
    orderIds.length?db.from("payments").select("id,amount,status,created_at,order_id")
      .in("order_id",orderIds).eq("status","paid").limit(100)
       :Promise.resolve({data:[],error:null}),
    bookingIds.length?db.from("payments").select("id,amount,status,created_at,booking_id")
      .in("booking_id",bookingIds).eq("status","paid").limit(100)
       :Promise.resolve({data:[],error:null})
  ]);
  if(paidOrders.error||paidBookings.error)return {ok:false,code:"unavailable"};
  const rows:RefundSource[]=[];
  for(const x of (paidOrders.data??[])){
    if(isValidId(x.id)&&orderIds.includes(x.order_id)&&typeof x.amount==="number")
      rows.push({id:x.id,amount:x.amount,status:x.status,created_at:x.created_at,subject_type:"order"});
  }
  for(const x of (paidBookings.data??[])){
    if(isValidId(x.id)&&bookingIds.includes(x.booking_id)&&typeof x.amount==="number")
      rows.push({id:x.id,amount:x.amount,status:x.status,created_at:x.created_at,subject_type:"booking"});
  }
  return {ok:true,rows:rows.sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,100)};
 }catch{return {ok:false,code:"unavailable"};}
}
export async function readOwnPayoutSources():Promise<ReadResult<PayoutSource>>{
 const actor=await requireRole(["partner_owner","partner_manager"]);
 if(!actor.ok||!actor.data.partnerId)return {ok:false,code:"unauthorized"};
 const context=await getAuthenticatedPartnerReadContext();
 if(!context||context.rest.userId!==actor.data.userId||
  context.businessId!==actor.data.partnerId)return {ok:false,code:"unauthorized"};
 if(!isSupabaseMode())return {ok:false,code:"unavailable"};
 try{
  const db=createSupabaseServiceRoleClient();
  const {data,error}=await db.from("kol_finance_journals_v1")
   .select("id,partner_allocation,currency,recognized_at,collection_model")
   .eq("business_id",context.businessId)
   .eq("collection_model","platform")
   .order("recognized_at",{ascending:false}).limit(100);
  if(error||!Array.isArray(data))return {ok:false,code:"unavailable"};
  const rows=data.filter(x=>isValidId(x.id)&&typeof x.partner_allocation==="number"&&
     x.partner_allocation>0&&x.collection_model==="platform") as PayoutSource[];
  return {ok:true,rows};
 }catch{return {ok:false,code:"unavailable"};}
}
