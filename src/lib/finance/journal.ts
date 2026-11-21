import "server-only";

import {requireRole} from "@/lib/auth/roles";
import {isSupabaseMode} from "@/lib/data/data-source";
import {getAuthenticatedPartnerReadContext} from "@/lib/data/authenticated-read-utils";
import {createSupabaseServiceRoleClient} from "@/lib/supabase/service-role";
import type {FinancePeriod} from "@/lib/finance/analytics";

type FinanceActionResult =
 | {ok:true;duplicate:boolean;journalId:string}
 | {ok:false;code:"not_authorized"|"invalid_input"|"unavailable"|"rejected"};
export type PostedJournalReport = {
 schema_version:1;kind:"posted_recognition_journal";period_from:string;period_to_exclusive:string;
 date_basis:"recognized_at";timezone:"Asia/Bishkek";business_id:string|null;
 journal_count:number;
 by_currency:Array<{currency:string;recognitions:number;verified_provider_gross:number;
   recognized_platform_fee:number;posted_partner_payable_before_payouts:number;
   posted_partner_receivable_before_collections:number}>;
 bank_settled:null;actual_paid_payout:null;net_profit:null;warning:string;
};
type ReportResult={ok:true;data:PostedJournalReport}|{ok:false;code:"not_authorized"|"unavailable"|"invalid_period"};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const key=/^[a-zA-Z0-9_.:-]{12,128}$/;
const ymd=/^\d{4}-\d{2}-\d{2}$/;
function periodValid(p:FinancePeriod):boolean {
 if(!p||!ymd.test(p.from)||!ymd.test(p.toExclusive))return false;
 const a=new Date(p.from+"T00:00:00Z"),b=new Date(p.toExclusive+"T00:00:00Z");
 return Number.isFinite(a.getTime())&&Number.isFinite(b.getTime())&&
  a.toISOString().slice(0,10)===p.from&&b.toISOString().slice(0,10)===p.toExclusive&&
  b.getTime()>a.getTime()&&b.getTime()-a.getTime()<=366*86400000;
}
// This is a privileged server function, not exposed as a browser action.
export async function postApprovedVerifiedRecognition(input:{
 subjectType:"order"|"booking";subjectId:string;idempotencyKey:string;
 approvalReference:string;
}):Promise<FinanceActionResult>{
 const identity=await requireRole(["super_admin"]);
 if(!identity.ok)return {ok:false,code:"not_authorized"};
 if(!isSupabaseMode()||!uuid.test(input.subjectId)||
    !key.test(input.idempotencyKey)||input.approvalReference.trim().length<8||
    input.approvalReference.trim().length>200||
    !["order","booking"].includes(input.subjectType))
    return {ok:false,code:"invalid_input"};
 try {
  const supabase=createSupabaseServiceRoleClient();
  const {data,error}=await supabase.rpc("kol_post_verified_recognition_v1",{
   p_subject_type:input.subjectType,p_subject_id:input.subjectId,
   p_idempotency_key:input.idempotencyKey,
   p_approved_by:identity.data.userId,
   p_approval_reference:input.approvalReference.trim()
  });
  if(error||!data||typeof data!=="object"||Array.isArray(data))return {ok:false,code:"rejected"};
  const row=data as Record<string,unknown>;
  if(row.ok!==true||typeof row.journal_id!=="string"||
      !uuid.test(row.journal_id)||typeof row.duplicate!=="boolean")
    return {ok:false,code:"rejected"};
  return {ok:true,duplicate:row.duplicate,journalId:row.journal_id};
 } catch{return {ok:false,code:"unavailable"};}
}
async function readScoped(p:FinancePeriod,businessId:string|null):Promise<ReportResult>{
 if(!periodValid(p))return {ok:false,code:"invalid_period"};
 if(!isSupabaseMode())return {ok:false,code:"unavailable"};
 try {
  const supabase=createSupabaseServiceRoleClient();
  const {data,error}=await supabase.rpc("kol_finance_journal_report_v1",{
    p_from:p.from,p_to:p.toExclusive,p_business_id:businessId
  });
  if(error||!data||typeof data!=="object"||Array.isArray(data))return {ok:false,code:"unavailable"};
  const v=data as Record<string,unknown>;
  if(v.schema_version!==1||v.kind!=="posted_recognition_journal"||
   v.business_id!==businessId||v.period_from!==p.from||
   v.period_to_exclusive!==p.toExclusive||!Array.isArray(v.by_currency)||
   v.bank_settled!==null||v.net_profit!==null)return {ok:false,code:"unavailable"};
  return {ok:true,data:data as PostedJournalReport};
 }catch{return {ok:false,code:"unavailable"};}
}
export async function readOwnerJournalReport(p:FinancePeriod):Promise<ReportResult>{
 const identity=await requireRole(["super_admin"]);
 if(!identity.ok)return {ok:false,code:"not_authorized"};
 return readScoped(p,null);
}
export async function readFinanceAdminJournalReport(p:FinancePeriod):Promise<ReportResult>{
 const identity=await requireRole(["super_admin","finance_admin"]);
 if(!identity.ok)return {ok:false,code:"not_authorized"};
 return readScoped(p,null);
}
export async function readPartnerJournalReport(p:FinancePeriod):Promise<ReportResult>{
 const identity=await requireRole(["partner_owner","partner_manager"]);
 if(!identity.ok||!identity.data.partnerId)return {ok:false,code:"not_authorized"};
 const context=await getAuthenticatedPartnerReadContext();
 if(!context||context.rest.userId!==identity.data.userId||
    context.businessId!==identity.data.partnerId)return {ok:false,code:"not_authorized"};
 return readScoped(p,context.businessId);
}
