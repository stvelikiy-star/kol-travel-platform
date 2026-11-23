"use server";

import {revalidatePath} from "next/cache";
import {requireRole} from "@/lib/auth/roles";
import {isSupabaseMode} from "@/lib/data/data-source";
import {createSupabaseServiceRoleClient} from "@/lib/supabase/service-role";

export type CostActionResult={
 ok:boolean;code:"ok"|"unauthorized"|"invalid"|"unavailable"|"rejected";
 journalId?:string;duplicate?:boolean;
};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const key=/^[a-zA-Z0-9_.:-]{12,128}$/;
const amount=/^\d{1,12}(?:\.\d{1,2})?$/;
const categories=new Set(["hosting","marketing","staff","logistics","operations","other"]);
export async function postOwnerAccruedExpense(form:FormData):Promise<CostActionResult>{
 const actor=await requireRole(["super_admin"]);
 if(!actor.ok)return {ok:false,code:"unauthorized"};
 const operation=String(form.get("operation")??"");
 const value=String(form.get("amount")??"");
 const currency=String(form.get("currency")??"");
 const category=String(form.get("category")??"");
 const business=String(form.get("business_id")??"");
 const document=String(form.get("document_reference")??"").trim();
 const approval=String(form.get("approval_reference")??"").trim();
 const idempotency=String(form.get("idempotency_key")??"");
 const original=String(form.get("original_id")??"");
 if(!isSupabaseMode()||!["expense","reversal"].includes(operation)||
    !amount.test(value)||Number(value)<=0||!categories.has(category)||
    !/^[A-Z]{3}$/.test(currency)||(business!==""&&!uuid.test(business))||
    (operation==="reversal"&&!uuid.test(original))||
    (operation==="expense"&&original!=="")||
    document.length<8||document.length>500||
    approval.length<8||approval.length>500||!key.test(idempotency))
   return {ok:false,code:"invalid"};
 try{
  const db=createSupabaseServiceRoleClient();
  const {data,error}=await db.rpc("kol_post_finance_cost_v1",{
    p_operation:operation,p_amount:value,p_currency:currency,
    p_category:category,p_business_id:business||null,
    p_document_reference:document,p_approved_by:actor.data.userId,
    p_approval_reference:approval,p_idempotency_key:idempotency,
    p_original_id:original||null
  });
  if(error||!data||typeof data!=="object"||Array.isArray(data))
    return {ok:false,code:"rejected"};
  const x=data as Record<string,unknown>;
  if(x.ok!==true||typeof x.journal_id!=="string"||!uuid.test(x.journal_id)||
     typeof x.duplicate!=="boolean")return {ok:false,code:"rejected"};
  revalidatePath("/admin/finance/costs");
  revalidatePath("/admin/finance");
  return {ok:true,code:"ok",journalId:x.journal_id,duplicate:x.duplicate};
 }catch{return {ok:false,code:"unavailable"};}
}
