import Link from "next/link";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {AdminLayout} from "@/components/layout/AdminLayout";
import {Card,CardHeader,CardTitle,CardDescription,CardContent} from "@/components/ui/Card";
import {requireSuperAdmin} from "@/lib/auth/roles";
import {isSupabaseMode} from "@/lib/data/data-source";
import {createSupabaseServiceRoleClient} from "@/lib/supabase/service-role";

export const dynamic="force-dynamic";
type Kind="payout"|"collection";
type Summary={currency:string;kind:Kind;obligation:number;recorded:number;remaining:number};
type Source={id:string;business_id:string;currency:string;kind:Kind;eligible:number;recorded:number;obligation:number};
type Evidence={id:string;journal_id:string;kind:Kind;currency:string;amount:number;evidence_date:string;evidence_reference:string;reversal_of:string|null;reversed:boolean};
type Report={by_currency:Summary[];sources:Source[];recent:Evidence[]};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const amountPattern=/^\d{1,12}(?:\.\d{1,2})?$/;
const isKind=(kind:unknown):kind is Kind=>kind==="payout"||kind==="collection";
const isCurrency=(value:unknown)=>typeof value==="string"&&/^[A-Z]{3}$/.test(value);
function kindLabel(kind:Kind){return kind==="payout"?"Выплата партнёру":"Получение комиссии";}
async function readReport():Promise<Report|null>{
 if(!isSupabaseMode())return null;
 try{
  const db=createSupabaseServiceRoleClient();
  const {data,error}=await db.rpc("kol_settlement_evidence_report_v1",{p_business_id:null});
  if(error||!data||data.kind!=="owner_attested_settlement_evidence"||data.business_id!==null||data.bank_verified!==false||data.money_transferred!==false||
   !Array.isArray(data.by_currency)||!Array.isArray(data.sources)||!Array.isArray(data.recent))return null;
  if(!data.by_currency.every((x:Summary)=>x&&isCurrency(x.currency)&&isKind(x.kind)&&[x.obligation,x.recorded,x.remaining].every(Number.isFinite))||
   !data.sources.every((x:Source)=>x&&uuid.test(x.id)&&uuid.test(x.business_id)&&isCurrency(x.currency)&&isKind(x.kind)&&[x.eligible,x.recorded,x.obligation].every(Number.isFinite))||
   !data.recent.every((x:Evidence)=>x&&uuid.test(x.id)&&uuid.test(x.journal_id)&&isKind(x.kind)&&isCurrency(x.currency)&&Number.isFinite(x.amount)&&typeof x.reversed==="boolean"))return null;
  return data as Report;
 }catch{return null;}
}
async function saveEvidence(form:FormData):Promise<never>{
 "use server";
 const owner=await requireSuperAdmin();
 const journal=String(form.get("journal_id")??"");
 const kind=String(form.get("kind")??"");
 const amount=String(form.get("amount")??"");
 const reference=String(form.get("reference")??"").trim();
 const date=String(form.get("evidence_date")??"");
 const reversal=String(form.get("reversal_of")??"");
 if(!owner.ok||!isSupabaseMode()||!uuid.test(journal)||!isKind(kind)||!amountPattern.test(amount)||Number(amount)<=0||
  reference.length<8||reference.length>250||!/^\d{4}-\d{2}-\d{2}$/.test(date)||(reversal&&!uuid.test(reversal))||form.get("confirm")!=="yes")
  redirect("/admin/finance/settlements?result=error");
 let saved=false;
 try{
  const db=createSupabaseServiceRoleClient();
  const {data,error}=await db.rpc("kol_record_settlement_evidence_v1",{
   p_journal_id:journal,p_kind:kind,p_amount:amount,p_reference:reference,p_evidence_date:date,p_actor:owner.data.userId,p_reversal_of:reversal||null
  });
  saved=!error&&data?.ok===true&&data?.money_transferred===false;
 }catch{saved=false;}
 if(saved){revalidatePath("/admin/finance/settlements");revalidatePath("/admin/finance");revalidatePath("/owner/analytics");}
 redirect("/admin/finance/settlements?result="+(saved?"saved":"error"));
}
function EvidenceForm({journal,kind,currency,max,original}:{journal:string;kind:Kind;currency:string;max:number;original?:string}){
 return <form action={saveEvidence} className="grid gap-3 rounded-lg border border-border bg-background p-4 text-sm">
  <input type="hidden" name="journal_id" value={journal}/><input type="hidden" name="kind" value={kind}/>
  {original?<><input type="hidden" name="reversal_of" value={original}/><input type="hidden" name="amount" value={max}/></>:<label className="grid gap-2">Сумма по документу ({currency})<input name="amount" type="number" min="0.01" max={max} step="0.01" required className="rounded-lg border border-border bg-surface p-3"/></label>}
  <label className="grid gap-2">Дата документа<input name="evidence_date" type="date" required className="rounded-lg border border-border bg-surface p-3"/></label>
  <label className="grid gap-2">Уникальный номер банковского документа или корректировки<input name="reference" required minLength={8} maxLength={250} className="rounded-lg border border-border bg-surface p-3"/></label>
  <label className="flex items-start gap-2"><input type="checkbox" name="confirm" value="yes" required/>Подтверждаю наличие документа и правильность суммы.</label>
  <div><button type="submit" className="rounded-lg bg-primary px-4 py-3 font-semibold text-white">{original?"Сторнировать запись":"Зарегистрировать документ"}</button></div>
 </form>;
}
export default async function SettlementsPage({searchParams}:{searchParams:Promise<{result?:string}>}){
 const owner=await requireSuperAdmin();
 if(!owner.ok)redirect("/not-authorized");
 const [report,params]=await Promise.all([readReport(),searchParams]);
 return <AdminLayout status={report?"stable":"attention"}>
  <Card><CardHeader><CardTitle>Документальные взаиморасчёты</CardTitle><CardDescription>Учёт внешних расчётов по документам собственника. KÖL не выполняет банковские переводы и не подтверждает их независимо.</CardDescription></CardHeader>
   <CardContent><Link href="/admin/finance" className="font-semibold text-primary">Назад к финансам</Link></CardContent>
  </Card>
  {params.result==="saved"&&<Card><CardContent className="p-4 text-sm"><p role="status">Документ зарегистрирован. Денежный перевод не выполнялся.</p></CardContent></Card>}
  {params.result==="error"&&<Card><CardContent className="p-4 text-sm"><p role="alert">Документ не принят. Проверьте сумму, основание, дату и состояние исходной операции.</p></CardContent></Card>}
  {!report?<Card><CardContent className="p-4 text-sm">Сводка взаиморасчётов недоступна.</CardContent></Card>:<>
   <Card><CardHeader><CardTitle>Остатки по зарегистрированным проводкам</CardTitle><CardDescription>За всё время, отдельно по валютам. Возвраты и банковская сверка учитываются отдельно.</CardDescription></CardHeader>
    <CardContent className="space-y-3 text-sm">{report.by_currency.length?report.by_currency.map(x=><div key={x.currency+":"+x.kind} className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-3">
     <div><p>{kindLabel(x.kind)} · {x.currency}</p><strong>{x.obligation}</strong></div><div><p>Учтено по документам</p><strong>{x.recorded} {x.currency}</strong></div><div><p>Остаток по документам</p><strong>{x.remaining} {x.currency}</strong></div>
    </div>):<p>Нет зарегистрированных начислений.</p>}</CardContent>
   </Card>
   <Card><CardHeader><CardTitle>Регистрация внешнего расчёта</CardTitle><CardDescription>Для выплат требуется одобренная заявка. Для получения комиссии используется договорная проводка. Операции с заявкой на возврат исключены.</CardDescription></CardHeader>
    <CardContent className="space-y-3">{report.sources.length?report.sources.map(x=><div key={x.id} className="space-y-2 rounded-lg border border-border p-4">
     <p className="font-semibold">{kindLabel(x.kind)} · {Math.round((x.eligible-x.recorded)*100)/100} {x.currency}</p>
     <p className="break-all text-xs text-muted">Проводка {x.id} · {x.business_id}</p>
     <EvidenceForm journal={x.id} kind={x.kind} currency={x.currency} max={Math.round((x.eligible-x.recorded)*100)/100}/>
    </div>):<p className="text-sm text-muted">Нет доступных операций для регистрации расчёта.</p>}</CardContent>
   </Card>
   <Card><CardHeader><CardTitle>История документов и корректировок</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">
    {report.recent.length?report.recent.map(x=><div key={x.id} className="space-y-2 rounded-lg border border-border p-4">
     <p className="font-semibold">{kindLabel(x.kind)} · {x.reversal_of?"−":""}{x.amount} {x.currency}</p>
     <p>{x.evidence_date} · {x.evidence_reference}</p>
     {x.reversal_of||x.reversed?<p className="text-muted">Сторно или сторнированная запись</p>:<details><summary className="cursor-pointer text-primary">Исправить ошибочную запись</summary><EvidenceForm journal={x.journal_id} kind={x.kind} currency={x.currency} max={x.amount} original={x.id}/></details>}
    </div>):<p>Документов пока нет.</p>}
   </CardContent></Card>
  </>}
 </AdminLayout>;
}
