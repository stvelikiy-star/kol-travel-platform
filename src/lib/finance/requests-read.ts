import "server-only";

import {requireClient,requireRole} from "@/lib/auth/roles";
import {isSupabaseMode} from "@/lib/data/data-source";
import {getAuthenticatedPartnerReadContext} from "@/lib/data/authenticated-read-utils";
import {createSupabaseServiceRoleClient} from "@/lib/supabase/service-role";

export type RefundSource={
 id:string;amount:number;currency:string;status:string;created_at:string;subject_type:"order"|"booking";
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
    db.from("bookings").select("id,booking_type,object_id,business_id").eq("client_id",actor.data.clientId)
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
  const roomIds=Array.from(new Set((bookings.data??[]).filter(x=>x.booking_type==="stay").map(x=>x.object_id).filter(isValidId)));
  const tourIds=Array.from(new Set((bookings.data??[]).filter(x=>x.booking_type==="tour").map(x=>x.object_id).filter(isValidId)));
  const [rooms,tours]=await Promise.all([
   roomIds.length?db.from("rooms").select("id,stay_id,business_id").in("id",roomIds):Promise.resolve({data:[],error:null}),
   tourIds.length?db.from("tours").select("id,currency,business_id").in("id",tourIds):Promise.resolve({data:[],error:null})
  ]);
  if(rooms.error||tours.error)return {ok:false,code:"unavailable"};
  const stayIds=Array.from(new Set((rooms.data??[]).map(x=>x.stay_id).filter(isValidId)));
  const stays=stayIds.length?await db.from("stays").select("id,currency,business_id").in("id",stayIds):{data:[],error:null};
  if(stays.error)return {ok:false,code:"unavailable"};
  const currencyByBooking=new Map<string,string>();
  for(const b of (bookings.data??[])){
   const room=(rooms.data??[]).find(x=>x.id===b.object_id&&x.business_id===b.business_id);
   const obj=b.booking_type==="stay"?(stays.data??[]).find(x=>x.id===room?.stay_id&&x.business_id===b.business_id):
    b.booking_type==="tour"?(tours.data??[]).find(x=>x.id===b.object_id&&x.business_id===b.business_id):undefined;
   if(obj&&typeof obj.currency==="string"&&/^[A-Z]{3}$/.test(obj.currency.trim()))currencyByBooking.set(b.id,obj.currency.trim());
  }
  const rows:RefundSource[]=[];
  for(const x of (paidOrders.data??[])){
    if(isValidId(x.id)&&orderIds.includes(x.order_id)&&typeof x.amount==="number")
      rows.push({id:x.id,amount:x.amount,status:x.status,created_at:x.created_at,subject_type:"order",currency:"KGS"});
  }
  for(const x of (paidBookings.data??[])){
    const currency=currencyByBooking.get(x.booking_id);
    if(isValidId(x.id)&&bookingIds.includes(x.booking_id)&&typeof x.amount==="number"&&currency)
      rows.push({id:x.id,amount:x.amount,status:x.status,created_at:x.created_at,subject_type:"booking",currency});
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

export type FinanceRequestHistoryRow={
 id:string;amount:number;currency:string;requested_at:string;payment_id:string|null;journal_id:string|null;
 decision:"pending"|"approved"|"rejected";
};

async function readScopedRequestHistory(kind:"refund"|"payout",scope:{column:"requested_by"|"business_id";id:string}):Promise<ReadResult<FinanceRequestHistoryRow>>{
 if(!isSupabaseMode())return {ok:false,code:"unavailable"};
 try{
  const db=createSupabaseServiceRoleClient();
  const requests=await db.from("kol_finance_requests_v1")
   .select("id,amount,currency,requested_at,payment_id,journal_id")
   .eq("request_kind",kind).eq(scope.column,scope.id).order("requested_at",{ascending:false}).limit(100);
  if(requests.error||!Array.isArray(requests.data))return {ok:false,code:"unavailable"};
  const ids=requests.data.map(x=>x.id);
  if(!ids.length)return {ok:true,rows:[]};
  const decisions=await db.from("kol_finance_decisions_v1").select("request_id,decision").in("request_id",ids);
  if(decisions.error||!Array.isArray(decisions.data))return {ok:false,code:"unavailable"};
  const byId=new Map(decisions.data.map(x=>[x.request_id,x.decision]));
  const rows:FinanceRequestHistoryRow[]=[];
  for(const r of requests.data){
   const decision=byId.get(r.id)??"pending";
   if(!isValidId(r.id)||!Number.isFinite(r.amount)||typeof r.currency!=="string"||
      !["pending","approved","rejected"].includes(decision))return {ok:false,code:"unavailable"};
   rows.push({id:r.id,amount:r.amount,currency:r.currency,requested_at:r.requested_at,
      payment_id:r.payment_id,journal_id:r.journal_id,decision:decision as FinanceRequestHistoryRow["decision"]});
  }
  return {ok:true,rows};
 }catch{return {ok:false,code:"unavailable"};}
}

export async function readOwnRefundRequestHistory():Promise<ReadResult<FinanceRequestHistoryRow>>{
 const actor=await requireClient();
 if(!actor.ok||!actor.data.clientId)return {ok:false,code:"unauthorized"};
 return readScopedRequestHistory("refund",{column:"requested_by",id:actor.data.userId});
}
export async function readOwnPayoutRequestHistory():Promise<ReadResult<FinanceRequestHistoryRow>>{
 const actor=await requireRole(["partner_owner","partner_manager"]);
 if(!actor.ok||!actor.data.partnerId)return {ok:false,code:"unauthorized"};
 const context=await getAuthenticatedPartnerReadContext();
 if(!context||context.rest.userId!==actor.data.userId||context.businessId!==actor.data.partnerId)return {ok:false,code:"unauthorized"};
 return readScopedRequestHistory("payout",{column:"business_id",id:context.businessId});
}
