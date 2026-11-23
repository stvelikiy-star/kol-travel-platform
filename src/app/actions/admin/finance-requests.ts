"use server";

import {revalidatePath} from "next/cache";
import {requireRole} from "@/lib/auth/roles";
import {isSupabaseMode} from "@/lib/data/data-source";
import {createSupabaseServiceRoleClient} from "@/lib/supabase/service-role";

// Approval requests are not disbursements. They cannot execute refunds/payouts.
type ActionResult={
 ok:boolean;code:"ok"|"unauthorized"|"invalid"|"unavailable"|"rejected";
 id?:string;duplicate?:boolean;
};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const key=/^[a-zA-Z0-9_.:-]{12,128}$/;
const amountPattern=/^\d{1,12}(?:\.\d{1,2})?$/;
function afterChange(){
 revalidatePath("/admin/finance/requests");
 revalidatePath("/partner/finance/requests");
}
export async function submitFinanceRequest(form:FormData):Promise<ActionResult>{
 const kind=String(form.get("request_kind")??"");
 const allow=kind==="refund" ? ["client","super_admin","finance_admin"] as const :
  kind==="payout" ? ["partner_owner","partner_manager","super_admin","finance_admin"] as const : null;
 if(!allow)return {ok:false,code:"invalid"};
 const actor=await requireRole([...allow]);
 if(!actor.ok)return {ok:false,code:"unauthorized"};
 const sourceId=String(form.get("source_id")??"");
 const amount=String(form.get("amount")??"");
 const keyValue=String(form.get("idempotency_key")??"");
 const reason=String(form.get("reason")??"").trim();
 if(!isSupabaseMode()||!uuid.test(sourceId)||!key.test(keyValue)||
   !amountPattern.test(amount)||Number(amount)<=0||reason.length<8||reason.length>1000)
   return {ok:false,code:"invalid"};
 try {
  const db=createSupabaseServiceRoleClient();
  const {data,error}=await db.rpc("kol_create_finance_request_v1",{
   p_kind:kind,p_source_id:sourceId,p_amount:amount,p_requested_by:actor.data.userId,
   p_idempotency_key:keyValue,p_reason:reason
  });
  if(error||!data||typeof data!=="object"||Array.isArray(data))
    return {ok:false,code:"rejected"};
  const row=data as Record<string,unknown>;
  if(row.ok!==true||typeof row.request_id!=="string"||!uuid.test(row.request_id)||
     typeof row.duplicate!=="boolean")return {ok:false,code:"rejected"};
  afterChange();
  return {ok:true,code:"ok",id:row.request_id,duplicate:row.duplicate};
 }catch{return {ok:false,code:"unavailable"};}
}
export async function decideFinanceRequest(form:FormData):Promise<ActionResult>{
 const actor=await requireRole(["super_admin"]);
 if(!actor.ok)return {ok:false,code:"unauthorized"};
 const id=String(form.get("request_id")??"");
 const decision=String(form.get("decision")??"");
 const proof=String(form.get("decision_reference")??"").trim();
 if(!isSupabaseMode()||!uuid.test(id)||!["approved","rejected"].includes(decision)||
    proof.length<8||proof.length>500)return {ok:false,code:"invalid"};
 try {
  const db=createSupabaseServiceRoleClient();
  const {data,error}=await db.rpc("kol_decide_finance_request_v1",{
   p_request_id:id,p_decision:decision,p_decided_by:actor.data.userId,p_evidence_ref:proof
  });
  if(error||!data||typeof data!=="object"||Array.isArray(data))
    return {ok:false,code:"rejected"};
  const row=data as Record<string,unknown>;
  if(row.ok!==true||row.money_transferred!==false||typeof row.decision_id!=="string"||
    !uuid.test(row.decision_id)||typeof row.duplicate!=="boolean")
    return {ok:false,code:"rejected"};
  afterChange();
  return {ok:true,code:"ok",id:row.decision_id,duplicate:row.duplicate};
 }catch{return {ok:false,code:"unavailable"};}
}
