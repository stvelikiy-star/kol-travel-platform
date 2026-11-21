import {randomUUID} from "node:crypto";
import {redirect} from "next/navigation";
import {AdminLayout} from "@/components/layout/AdminLayout";
import {Badge} from "@/components/ui/Badge";
import {Card,CardContent,CardDescription,CardHeader,CardTitle} from "@/components/ui/Card";
import {requireSuperAdmin} from "@/lib/auth/roles";
import {isSupabaseMode} from "@/lib/data/data-source";
import {createSupabaseServiceRoleClient} from "@/lib/supabase/service-role";
import {currentBishkekFinanceMonth} from "@/lib/finance/report-period";
import {postOwnerAccruedExpense} from "@/app/actions/admin/finance-costs";
export const dynamic="force-dynamic";
export const runtime="nodejs";
type CostRow={id:string;operation:string;original_id:string|null;
 amount:number;currency:string;category:string;business_id:string|null;
 document_reference:string;posted_at:string};
type Partner={id:string;title:string};
type CostReport={cost_entries:number;by_currency:Array<{
 currency:string;recognized_expense_activity:number;original_expenses:number;reversals:number;
}>};
async function submit(form:FormData):Promise<never>{
 "use server";
 const result=await postOwnerAccruedExpense(form);
 redirect("/admin/finance/costs?result="+(result.ok?"saved":"error"));
}
const field="w-full rounded-lg border border-border bg-surface p-3 text-sm";
const categories=[
 {value:"hosting",label:"Хостинг и инфраструктура"},
 {value:"marketing",label:"Маркетинг"},
 {value:"staff",label:"Персонал"},
 {value:"logistics",label:"Логистика"},
 {value:"operations",label:"Операционные расходы"},
 {value:"other",label:"Прочее"}
];
export default async function OwnerAccruedCosts({
 searchParams
}:{searchParams:Promise<{result?:string}>}){
 const actor=await requireSuperAdmin();
 if(!actor.ok)redirect("/not-authorized");
 const params=await searchParams;
 const period=currentBishkekFinanceMonth();
 let rows:CostRow[]=[],partners:Partner[]=[];
 let summary:CostReport|null=null;
 let available=false;
 if(isSupabaseMode()){
  try{
   const db=createSupabaseServiceRoleClient();
   const [costs,companies,report]=await Promise.all([
    db.from("kol_finance_cost_journals_v1")
     .select("id,operation,original_id,amount,currency,category,business_id,document_reference,posted_at")
     .order("posted_at",{ascending:false}).limit(100),
    db.from("partners").select("id,title").order("title",{ascending:true}).limit(100),
    db.rpc("kol_finance_cost_report_v1",{
      p_from:period.from,p_to:period.toExclusive,p_business_id:null
    })
   ]);
   if(!costs.error&&!companies.error&&!report.error&&report.data&&typeof report.data==="object"){
    rows=(costs.data??[]) as CostRow[];
    partners=(companies.data??[]) as Partner[];
    summary=report.data as CostReport;
    available=true;
   }
  }catch{/* fail closed */}
 }
 const reversed=new Set(rows.filter(r=>r.operation==="reversal").map(r=>r.original_id));
 return <AdminLayout status={available?"stable":"attention"}>
  <Card>
   <CardHeader><Badge variant="info">OWNER · Финансы</Badge><CardTitle>Расходы и корректировки</CardTitle>
    <CardDescription>
     Учёт начисленных расходов и исправлений. Отдельно от фактических банковских платежей.
    </CardDescription>
   </CardHeader>
   <CardContent className="text-sm text-muted">
    Ссылка на документ и подтверждение OWNER обязательны. Записи нельзя удалять или менять;
    ошибку исправляют отдельным сторно. Чистая прибыль и оплата банка — Не подтверждено.
   </CardContent>
  </Card>
  {params.result?<Card><CardContent className="p-4 text-sm">
   {params.result==="saved"?"Запись добавлена в журнал. Банковский платёж не выполнен.":
     "Запись отклонена. Проверьте основание, полномочия и наличие прежней операции."}
  </CardContent></Card>:null}
  {!available?<Card><CardContent className="p-4 text-sm">
    Финансовый журнал недоступен. Демонстрационные расходы не показываются и не записываются.
  </CardContent></Card>:(
   <>
    <Card>
     <CardHeader><CardTitle>Расходы за текущий месяц</CardTitle>
      <CardDescription>Период {period.from} — {period.toExclusive}, дата окончания не включена.</CardDescription>
     </CardHeader>
     <CardContent className="space-y-2 text-sm">
      <p>Записей в журнале: <strong>{summary?.cost_entries??"—"}</strong>.</p>
      {summary?.by_currency?.length?summary.by_currency.map(x=>
       <p className="rounded-lg border border-border bg-background p-3" key={x.currency}>
        {x.currency}: учтено расходов и сторно {x.recognized_expense_activity};
        расходы {x.original_expenses}, сторно {x.reversals}.
       </p>):<p className="text-muted">Расходов по документам за период нет.</p>}
      <p className="text-muted">Это не чистая прибыль и не подтверждённый банковский расход.</p>
     </CardContent>
    </Card>
    <Card>
     <CardHeader><CardTitle>Добавить начисленный расход</CardTitle></CardHeader>
     <CardContent>
      <form action={submit} className="grid gap-4">
       <input type="hidden" name="operation" value="expense"/>
       <input type="hidden" name="idempotency_key" value={"cost:"+randomUUID()}/>
       <label className="grid gap-2 text-sm">Категория
        <select name="category" className={field}>{categories.map(c=>
          <option key={c.value} value={c.value}>{c.label}</option>)}</select>
       </label>
       <label className="grid gap-2 text-sm">Бизнес
        <select name="business_id" className={field}>
         <option value="">Общие расходы KÖL</option>
         {partners.map(x=><option key={x.id} value={x.id}>{x.title}</option>)}
        </select>
       </label>
       <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm">Сумма
         <input name="amount" type="number" min="0.01" step="0.01" required className={field}/>
        </label>
        <label className="grid gap-2 text-sm">Валюта
         <select name="currency" className={field}>
          <option value="KGS">KGS</option><option value="USD">USD</option><option value="EUR">EUR</option>
         </select>
        </label>
       </div>
       <label className="grid gap-2 text-sm">Основание документа
        <input name="document_reference" required minLength={8} maxLength={500}
         placeholder="Номер и дата счёта / договора / акта" className={field}/>
       </label>
       <label className="grid gap-2 text-sm">Подтверждение OWNER
        <input name="approval_reference" required minLength={8} maxLength={500}
         placeholder="Основание утверждения проводки" className={field}/>
       </label>
       <p className="text-sm text-muted">
        Это начисление, а не банковская оплата. Документы и фактическое движение денег проверяются отдельно.
       </p>
       <div><button type="submit" className="rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white">
        Записать начисленный расход
       </button></div>
      </form>
     </CardContent>
    </Card>
    <Card>
     <CardHeader><CardTitle>История и сторно</CardTitle></CardHeader>
     <CardContent className="space-y-3">
      {rows.length===0?<p className="text-sm text-muted">Нет записей в журнале.</p>:rows.map(x=>
       <div key={x.id} className="space-y-3 rounded-lg border border-border bg-background p-4 text-sm">
        <div className="flex flex-wrap items-center gap-3">
         <Badge variant={x.operation==="expense"?"warning":"info"}>
          {x.operation==="expense"?"Начисление":"Сторно"}
         </Badge><strong>{x.amount} {x.currency}</strong><span>{x.category}</span>
        </div>
        <p className="text-muted">Документ: {x.document_reference}</p>
        <p className="break-all text-xs text-muted">ID: {x.id}</p>
        {x.operation==="expense"&&!reversed.has(x.id)?<form action={submit} className="grid gap-2">
         <input type="hidden" name="operation" value="reversal"/>
         <input type="hidden" name="original_id" value={x.id}/>
         <input type="hidden" name="idempotency_key" value={"reversal:"+x.id}/>
         <input type="hidden" name="business_id" value={x.business_id??""}/>
         <input type="hidden" name="category" value={x.category}/>
         <input type="hidden" name="currency" value={x.currency}/>
         <input type="hidden" name="amount" value={x.amount}/>
         <input name="document_reference" minLength={8} maxLength={500} required
          placeholder="Причина исправления, документ" className={field}/>
         <input name="approval_reference" minLength={8} maxLength={500} required
          placeholder="Подтверждение OWNER" className={field}/>
         <div><button type="submit" className="rounded-lg border border-primary px-3 py-2 text-xs font-semibold text-primary">
           Сделать сторно
         </button></div>
        </form>:null}
       </div>)}
     </CardContent>
    </Card>
   </>
  )}
 </AdminLayout>;
}
