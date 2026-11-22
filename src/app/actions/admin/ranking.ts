"use server";

import {revalidatePath} from "next/cache";
import {requireRole} from "@/lib/auth/roles";
import {isSupabaseMode} from "@/lib/data/data-source";
import {createSupabaseServerClient} from "@/lib/supabase/server";

type Result={ok:boolean;code:"ok"|"unauthorized"|"invalid"|"unavailable"|"rejected"};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const amount=/^\d{1,10}(?:\.\d{1,2})?$/;
function changed(){for(const p of ["/admin/ranking","/stays","/tours"])revalidatePath(p);}
async function readTarget(db:NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,kind:string,id:string){
 if(!["stay","tour"].includes(kind)||!uuid.test(id))return false;
 const tbl=kind==="stay"?"stays":"tours";
 const {data,error}=await db.from(tbl).select("id,business_id").eq("id",id).maybeSingle();
 return !error&&data?.id===id&&typeof data.business_id==="string";
}
export async function setEditorialListingScore(form:FormData):Promise<Result>{
 const actor=await requireRole(["super_admin","content_manager"]);
 if(!actor.ok)return {ok:false,code:"unauthorized"};
 const kind=String(form.get("target_type")??"");
 const id=String(form.get("target_id")??"");
 const raw=String(form.get("score")??"");
 const note=String(form.get("note")??"").trim();
 if(!isSupabaseMode()||!/^[1-5](?:\.\d)?$/.test(raw)||Number(raw)<1||Number(raw)>5||
    note.length>1500||!["stay","tour"].includes(kind)||!uuid.test(id))
   return {ok:false,code:"invalid"};
 const db=await createSupabaseServerClient();if(!db)return {ok:false,code:"unavailable"};
 try{
  if(!await readTarget(db,kind,id))return {ok:false,code:"rejected"};
  const {data,error}=await db.from("editorial_scores")
   .upsert({target_type:kind,target_id:id,score:Number(raw),note:note||null,
     updated_by:actor.data.userId},{onConflict:"target_type,target_id"})
   .select("id").single();
  if(error||!data||!uuid.test(data.id))return {ok:false,code:"rejected"};
  changed();return {ok:true,code:"ok"};
 }catch{return {ok:false,code:"unavailable"};}
}
export async function createListingPromotion(form:FormData):Promise<Result>{
 const actor=await requireRole(["super_admin","content_manager"]);
 if(!actor.ok)return {ok:false,code:"unauthorized"};
 const kind=String(form.get("target_type")??"");
 const id=String(form.get("target_id")??"");
 const label=String(form.get("label")??"");
 const position=Number(form.get("position"));
 const raw=String(form.get("price_kgs")??"");
 if(!isSupabaseMode()||!["stay","tour"].includes(kind)||!uuid.test(id)||
   !["recommended","ad"].includes(label)||!Number.isInteger(position)||position<1||position>50||
   !amount.test(raw)||(label==="recommended"&&Number(raw)>0))
   return {ok:false,code:"invalid"};
 const db=await createSupabaseServerClient();if(!db)return {ok:false,code:"unavailable"};
 try{
  if(!await readTarget(db,kind,id))return {ok:false,code:"rejected"};
  const {data,error}=await db.from("listing_promotions").insert({
   target_type:kind,target_id:id,label,position,price_kgs:Number(raw),
   payment_status:"pending",is_active:false,created_by:actor.data.userId
  }).select("id").single();
  if(error||!data||!uuid.test(data.id))return {ok:false,code:"rejected"};
  changed();return {ok:true,code:"ok"};
 }catch{return {ok:false,code:"unavailable"};}
}
export async function confirmListingPromotionPayment(form:FormData):Promise<Result>{
 const actor=await requireRole(["super_admin","content_manager"]);
 if(!actor.ok)return {ok:false,code:"unauthorized"};
 const id=String(form.get("promotion_id")??"");
 const proof=String(form.get("payment_evidence")??"").trim();
 if(!isSupabaseMode()||!uuid.test(id)||proof.length<8||proof.length>500)
   return {ok:false,code:"invalid"};
 const db=await createSupabaseServerClient();if(!db)return {ok:false,code:"unavailable"};
 try{
  const {data,error}=await db.from("listing_promotions")
   .update({payment_status:"paid",payment_evidence:proof})
   .eq("id",id).select("id").single();
  if(error||data?.id!==id)return {ok:false,code:"rejected"};
  changed();return {ok:true,code:"ok"};
 }catch{return {ok:false,code:"unavailable"};}
}
export async function setPromotionActive(form:FormData):Promise<Result>{
 const actor=await requireRole(["super_admin","content_manager"]);
 if(!actor.ok)return {ok:false,code:"unauthorized"};
 const id=String(form.get("promotion_id")??"");
 const flag=String(form.get("is_active")??"");
 if(!isSupabaseMode()||!uuid.test(id)||!["true","false"].includes(flag))
  return {ok:false,code:"invalid"};
 const db=await createSupabaseServerClient();if(!db)return {ok:false,code:"unavailable"};
 try{
  // SQL refuses paid placement without evidence and owner confirmation.
  const {data,error}=await db.from("listing_promotions")
   .update({is_active:flag==="true"}).eq("id",id)
   .select("id,is_active").single();
  if(error||data?.id!==id||data.is_active!==(flag==="true"))return {ok:false,code:"rejected"};
  changed();return {ok:true,code:"ok"};
 }catch{return {ok:false,code:"unavailable"};}
}
