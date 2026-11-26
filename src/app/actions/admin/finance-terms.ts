"use server";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {requireRole} from "@/lib/auth/roles";
import {isSupabaseMode} from "@/lib/data/data-source";
import {createSupabaseServiceRoleClient} from "@/lib/supabase/service-role";
export async function saveContractTerm(form:FormData):Promise<never> {
  const actor=await requireRole(["super_admin"]);
  if(!actor.ok||!isSupabaseMode())redirect("/admin/finance?terms=error");
  const business=String(form.get("business_id")??"");
  const line=String(form.get("service_line")??"");
  const currency=String(form.get("currency")??"");
  const rate=String(form.get("rate_percent")??"").trim();
  const fixed=String(form.get("fixed_fee")??"").trim();
  const model=String(form.get("collection_model")??"");
  const from=String(form.get("valid_from")??"");
  const until=String(form.get("valid_until")??"");
  const agreement=String(form.get("agreement_reference")??"").trim();
  const validDate=(value:string)=>{
    if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
    const date=new Date(value+"T00:00:00Z");
    return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
  };
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(business)||
     !["food","shop","stay","tour"].includes(line)||!/^[A-Z]{3}$/.test(currency)||
     !/^\d{1,3}(?:\.\d{1,4})?$/.test(rate)||Number(rate)>100||
     !/^\d{1,10}(?:\.\d{1,2})?$/.test(fixed)||!["platform","partner"].includes(model)||
     !validDate(from)||!validDate(until)||until<=from||agreement.length<6||agreement.length>250)
    redirect("/admin/finance?terms=error");
  let saved=false;
  try {
    const db=createSupabaseServiceRoleClient();
    const partner=await db.from("partners").select("id").eq("id",business).eq("status","approved").maybeSingle();
    if(!partner.error&&partner.data){
      const {error}=await db.from("kol_finance_terms_v1").insert({
        business_id:business,service_line:line,currency,rate_percent:rate,fixed_fee:fixed,
        collection_model:model,valid_from:from,valid_until:until,agreement_reference:agreement,
        approved_by:actor.data.userId
      });
      saved=!error;
    }
  } catch {saved=false;}
  if(saved){revalidatePath("/admin/finance");revalidatePath("/partner/finance");}
  redirect("/admin/finance?terms="+(saved?"saved":"error"));
}

