"use server";

import { requireClient, requireRole } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ReviewActionResult = {ok:boolean;code:"ok"|"unauthorized"|"invalid"|"unavailable"|"rejected"};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const reasons = new Set(["spam","abuse","off_topic","personal_data","wrong_object","duplicate","other"]);
type TargetType = "stay"|"tour";
function isType(value:string):value is TargetType{return value==="stay"||value==="tour";}
function refreshReviewPages() {revalidatePath("/admin/ranking");revalidatePath("/stays");revalidatePath("/tours");}

export async function submitGuestReview(data:FormData):Promise<ReviewActionResult>{
  const actor=await requireClient();
  if(!actor.ok||!actor.data.clientId)return {ok:false,code:"unauthorized"};
  const bookingId=String(data.get("booking_id")??"");
  const businessId=String(data.get("business_id")??"");
  const rating=Number(data.get("rating"));
  const content=String(data.get("text")??"").trim();
  if(!uuid.test(bookingId)||!uuid.test(businessId)||!Number.isInteger(rating)||rating<1||rating>5||
     content.length<3||content.length>2000)return {ok:false,code:"invalid"};
  const client=await createSupabaseServerClient();
  if(!client)return {ok:false,code:"unavailable"};
  try {
    // Atomic trigger verifies this client's completed booking and derives the target.
    // The UNIQUE (client_id, booking_id) constraint permits only one real review.
    const {data:created,error}=await client.from("reviews")
      .insert({client_id:actor.data.clientId,business_id:businessId,booking_id:bookingId,
        source:"site",rating,text:content,status:"new"}).select("id,status").single();
    if(error||!created||created.status!=="new")return {ok:false,code:"rejected"};
    refreshReviewPages();
    return {ok:true,code:"ok"};
  }catch{return {ok:false,code:"unavailable"};}
}

export async function importVerifiedExternalReview(data:FormData):Promise<ReviewActionResult>{
  const actor=await requireRole(["super_admin","content_manager"]);
  if(!actor.ok)return {ok:false,code:"unauthorized"};
  const businessId=String(data.get("business_id")??"");
  const targetId=String(data.get("target_id")??"");
  const targetType=String(data.get("target_type")??"");
  const sourceLabel=String(data.get("source_label")??"").trim();
  const evidenceUrl=String(data.get("source_evidence_url")??"").trim();
  const rating=Number(data.get("rating"));
  const content=String(data.get("text")??"").trim();
  let safeEvidence=false;
  try{const url=new URL(evidenceUrl);safeEvidence=url.protocol==="https:"&&!!url.hostname&&!url.username&&!url.password;}catch{}
  if(!uuid.test(businessId)||!uuid.test(targetId)||!isType(targetType)||!safeEvidence||
     sourceLabel.length<2||sourceLabel.length>160||!Number.isInteger(rating)||rating<1||rating>5||
     content.length<3||content.length>2000)return {ok:false,code:"invalid"};
  const client=await createSupabaseServerClient();
  if(!client)return {ok:false,code:"unavailable"};
  try {
    const {data:created,error}=await client.from("reviews").insert({
      client_id:null,booking_id:null,business_id:businessId,target_type:targetType,target_id:targetId,
      source:"import",source_label:sourceLabel,source_evidence_url:evidenceUrl,
      rating,text:content,status:"new"
    }).select("id,status").single();
    if(error||!created||created.status!=="new")return {ok:false,code:"rejected"};
    refreshReviewPages();return {ok:true,code:"ok"};
  }catch{return {ok:false,code:"unavailable"};}
}

export async function moderateReview(data:FormData):Promise<ReviewActionResult>{
  const actor=await requireRole(["super_admin","content_manager"]);
  if(!actor.ok)return {ok:false,code:"unauthorized"};
  const id=String(data.get("review_id")??"");
  const decision=String(data.get("decision")??"");
  const hiddenReason=String(data.get("hidden_reason")??"");
  const adminReply=String(data.get("admin_reply")??"").trim();
  if(!uuid.test(id)||!["published","hidden"].includes(decision)||
     (decision==="hidden"&&!reasons.has(hiddenReason))||
     adminReply.length>1000)return {ok:false,code:"invalid"};
  const client=await createSupabaseServerClient();
  if(!client)return {ok:false,code:"unavailable"};
  try {
    // DB trigger enforces content/source/identity immutability and writes the audit row.
    const {data:changed,error}=await client.from("reviews")
      .update({status:decision,hidden_reason:decision==="hidden"?hiddenReason:null,
        admin_reply:adminReply||null})
      .eq("id",id).select("id,status").single();
    if(error||!changed||changed.status!==decision)return {ok:false,code:"rejected"};
    refreshReviewPages();return {ok:true,code:"ok"};
  }catch{return {ok:false,code:"unavailable"};}
}
