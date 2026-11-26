import "server-only";
import {requireRole} from "@/lib/auth/roles";
import {isSupabaseMode} from "@/lib/data/data-source";
import {createSupabaseServiceRoleClient} from "@/lib/supabase/service-role";
import type {FinancePeriod} from "@/lib/finance/analytics";
type RecognitionCandidate = { id: string; kind: "order" | "booking"; total: number };
type CostSummary = { currency: string; recognized_expense_activity: number };

export async function readFinanceWorkspace(period: FinancePeriod) {
  const actor=await requireRole(["super_admin","finance_admin"]);
  const canPost=actor.ok&&actor.data.role==="super_admin";
  if (!actor.ok||!isSupabaseMode()) return { candidates: null, costs: null };
  try {
    const db = createSupabaseServiceRoleClient();
    const [costReport, orders, bookings] = await Promise.all([
      db.rpc("kol_finance_cost_report_v1", {
        p_from: period.from, p_to: period.toExclusive, p_business_id: null
      }),
      canPost ? db.from("orders").select("id,total").eq("status","completed").eq("payment_status","paid").order("created_at",{ascending:false}).limit(100) : null,
      canPost ? db.from("bookings").select("id,total").eq("status","completed").eq("payment_status","paid").order("created_at",{ascending:false}).limit(100) : null
    ]);
    const raw = costReport.data;
    let costs: CostSummary[] | null = null;
    if (!costReport.error && raw && raw.kind === "owner_attested_expense_activity" &&
        raw.business_id === null && raw.period_from === period.from && raw.period_to_exclusive === period.toExclusive &&
        Array.isArray(raw.by_currency) && raw.by_currency.every((row: CostSummary) =>
          typeof row.currency === "string" && /^[A-Z]{3}$/.test(row.currency) &&
          Number.isFinite(row.recognized_expense_activity))) {
      costs = raw.by_currency as CostSummary[];
    }
    let candidates: RecognitionCandidate[] | null = null;
    if (canPost && orders && bookings && !orders.error && !bookings.error) {
      const items: RecognitionCandidate[] = [
        ...(orders.data ?? []).map(x => ({id:x.id,kind:"order" as const,total:x.total})),
        ...(bookings.data ?? []).map(x => ({id:x.id,kind:"booking" as const,total:x.total}))
      ];
      if (!items.length) candidates = [];
      else {
        const posted = await db.from("kol_finance_journals_v1").select("subject_type,subject_id")
          .eq("journal_kind","recognition").in("subject_id",items.map(x=>x.id));
        if (!posted.error) {
          const keys = new Set((posted.data ?? []).map(x=>x.subject_type+":"+x.subject_id));
          candidates = items.filter(x=>!keys.has(x.kind+":"+x.id));
        }
      }
    }
    return { candidates, costs };
  } catch { return { candidates: null, costs: null }; }
}

type FinanceTerm = {
  id:string; business_id:string; service_line:string; currency:string; rate_percent:number;
  fixed_fee:number; collection_model:string; valid_from:string; valid_until:string; agreement_reference:string;
};
export async function readContractTerms() {
  const actor=await requireRole(["super_admin"]);
  if (!actor.ok || !isSupabaseMode()) return null;
  try {
    const db=createSupabaseServiceRoleClient();
    const [partners,terms]=await Promise.all([
      db.from("partners").select("id,title").eq("status","approved").order("title").limit(200),
      db.from("kol_finance_terms_v1").select("id,business_id,service_line,currency,rate_percent,fixed_fee,collection_model,valid_from,valid_until,agreement_reference").order("valid_from",{ascending:false}).limit(200)
    ]);
    if(partners.error||terms.error)return null;
    return {partners:(partners.data??[]) as {id:string;title:string}[],terms:(terms.data??[]) as FinanceTerm[]};
  } catch {return null;}
}

type CostRow={currency:string;recognized_expense_activity:number};
export async function readOwnerCosts(period:FinancePeriod):Promise<CostRow[]|null>{
 const actor=await requireRole(["super_admin"]);
 if(!actor.ok||!isSupabaseMode())return null;
 try{
  const db=createSupabaseServiceRoleClient();
  const {data,error}=await db.rpc("kol_finance_cost_report_v1",{p_from:period.from,p_to:period.toExclusive,p_business_id:null});
  if(error||!data||data.kind!=="owner_attested_expense_activity"||data.schema_version!==1||
     data.business_id!==null||data.period_from!==period.from||data.period_to_exclusive!==period.toExclusive||
     !Array.isArray(data.by_currency)||!data.by_currency.every((x:CostRow)=>x&&typeof x.currency==="string"&&/^[A-Z]{3}$/.test(x.currency)&&Number.isFinite(x.recognized_expense_activity)))return null;
  return data.by_currency as CostRow[];
 }catch{return null;}
}
