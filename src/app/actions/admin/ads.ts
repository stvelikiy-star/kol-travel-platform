"use server";

import {revalidatePath} from "next/cache";
import {requireRole} from "@/lib/auth/roles";
import {isSupabaseMode} from "@/lib/data/data-source";
import {createSupabaseServerClient} from "@/lib/supabase/server";

type Result={ok:boolean;code:"ok"|"unauthorized"|"invalid"|"unavailable"|"rejected"};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const number=/^\d{1,10}(?:\.\d{1,2})?$/;
const allowedSlots=new Set(["top_strip","home_between","catalog_inline","detail_side","cart_banner"]);
const allowedStates=new Set(["draft","review","active","paused","ended"]);
function interval(value:string):string|null{
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))return null;
 const parsed=new Date(value+":00+06:00");
 return Number.isFinite(parsed.valueOf())?parsed.toISOString():null;
}
function safeHref(value:string):string|null{
 if(!value)return null;
 if(value.startsWith("/")&&!value.startsWith("//")&&!value.includes("\\")&&
    !/[\u0000-\u001f]/.test(value))return value;
 try{
  const url=new URL(value);
  return url.protocol==="https:"&&!!url.hostname&&!url.username&&!url.password?url.toString():null;
 }catch{return null;}
}
function refresh(){
 revalidatePath("/admin/ads");revalidatePath("/");revalidatePath("/stays");
 revalidatePath("/tours");revalidatePath("/delivery");
}
export async function createAdDraft(form:FormData):Promise<Result>{
 const actor=await requireRole(["super_admin","content_manager"]);
 if(!actor.ok)return {ok:false,code:"unauthorized"};
 const slot=String(form.get("slot_code")??"");
 const advertiser=String(form.get("advertiser_name")??"").trim();
 const title=String(form.get("title_ru")??"").trim();
 const titleKy=String(form.get("title_ky")??"").trim();
 const titleEn=String(form.get("title_en")??"").trim();
 const link=String(form.get("link_url")??"").trim();
 const imagePath=String(form.get("image_path")??"").trim();
 const start=interval(String(form.get("starts_at")??""));
 const end=interval(String(form.get("ends_at")??""));
 const price=String(form.get("price_kgs")??"");
 const href=safeHref(link);
 if(!isSupabaseMode()||!allowedSlots.has(slot)||advertiser.length<2||advertiser.length>160||
    title.length<1||title.length>120||titleKy.length>120||titleEn.length>120||
    !start||!end||new Date(end)<=new Date(start)||!number.test(price)||
    (link!==""&&!href)||(imagePath!==""&&!imagePath.startsWith("/media/kol/"))||
    imagePath.includes(".."))return {ok:false,code:"invalid"};
 const db=await createSupabaseServerClient();
 if(!db)return {ok:false,code:"unavailable"};
 try{
  const {data,error}=await db.from("site_ad_campaigns").insert({
   slot_code:slot,advertiser_name:advertiser,title_ru:title,title_ky:titleKy||null,
   title_en:titleEn||null,link_url:href,image_path:imagePath||null,
   starts_at:start,ends_at:end,status:"draft",price_kgs:Number(price),
   payment_status:"pending",disclosure_label:"Реклама",
   created_by:actor.data.userId
  }).select("id,status").single();
  if(error||!data||data.status!=="draft"||!uuid.test(data.id))
   return {ok:false,code:"rejected"};
  refresh();return {ok:true,code:"ok"};
 }catch{return {ok:false,code:"unavailable"};}
}
export async function setAdCampaignStatus(form:FormData):Promise<Result>{
 const actor=await requireRole(["super_admin","content_manager"]);
 if(!actor.ok)return {ok:false,code:"unauthorized"};
 const id=String(form.get("campaign_id")??"");
 const status=String(form.get("status")??"");
 if(!isSupabaseMode()||!uuid.test(id)||!allowedStates.has(status))return {ok:false,code:"invalid"};
 const db=await createSupabaseServerClient();
 if(!db)return {ok:false,code:"unavailable"};
 try{
  // DB refuses activation of unpaid campaigns; result is intentionally fail closed.
  const {data,error}=await db.from("site_ad_campaigns").update({status})
    .eq("id",id).select("id,status").single();
  if(error||!data||data.status!==status)return {ok:false,code:"rejected"};
  refresh();return {ok:true,code:"ok"};
 }catch{return {ok:false,code:"unavailable"};}
}
export async function confirmAdPaymentByOwner(form:FormData):Promise<Result>{
 const actor=await requireRole(["super_admin"]);
 if(!actor.ok)return {ok:false,code:"unauthorized"};
 const id=String(form.get("campaign_id")??"");
 const evidence=String(form.get("payment_evidence")??"").trim();
 if(!isSupabaseMode()||!uuid.test(id)||evidence.length<8||evidence.length>500)
   return {ok:false,code:"invalid"};
 const db=await createSupabaseServerClient();
 if(!db)return {ok:false,code:"unavailable"};
 try{
  // Authenticated JWT preserves auth.uid() for the immutable DB money guard.
  // Manual evidence is NOT a bank-ledger posting.
  const {data,error}=await db.from("site_ad_campaigns").update({
    payment_status:"paid",payment_evidence:evidence
  }).eq("id",id).select("id").single();
  if(error||!data||!uuid.test(data.id))return {ok:false,code:"rejected"};
  refresh();return {ok:true,code:"ok"};
 }catch{return {ok:false,code:"unavailable"};}
}
