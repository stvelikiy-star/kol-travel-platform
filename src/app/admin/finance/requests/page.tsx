import {redirect} from "next/navigation";
import {AdminLayout} from "@/components/layout/AdminLayout";
import {Badge} from "@/components/ui/Badge";
import {Card,CardContent,CardHeader,CardTitle} from "@/components/ui/Card";
import {requireSuperAdmin} from "@/lib/auth/roles";
import {isSupabaseMode} from "@/lib/data/data-source";
import {createSupabaseServiceRoleClient} from "@/lib/supabase/service-role";
import {decideFinanceRequest} from "@/app/actions/admin/finance-requests";

export const dynamic="force-dynamic";
type RequestRow={
 id:string;request_kind:string;business_id:string;amount:number;currency:string;
 requested_by:string;reason:string;requested_at:string;
};
type DecisionRow={request_id:string;decision:string;decision_reference:string;decided_at:string};
async function decisionSubmit(form:FormData):Promise<never>{
 "use server";
 const result=await decideFinanceRequest(form);
 redirect("/admin/finance/requests?result="+(result.ok?"saved":"error")+"&code="+result.code);
}
export default async function AdminFinanceRequests({
 searchParams
}:{searchParams:Promise<{result?:string;code?:string}>}){
 const actor=await requireSuperAdmin();
 if(!actor.ok)redirect("/not-authorized");
 const args=await searchParams;
 let requests:RequestRow[]=[];
 let decisions:DecisionRow[]=[];
 let accessible=false;
 if(isSupabaseMode()){
   try {
    const db=createSupabaseServiceRoleClient();
    const [r,d]=await Promise.all([
      db.from("kol_finance_requests_v1")
        .select("id,request_kind,business_id,amount,currency,requested_by,reason,requested_at")
        .order("requested_at",{ascending:false}).limit(100),
      db.from("kol_finance_decisions_v1")
        .select("request_id,decision,decision_reference,decided_at")
        .order("decided_at",{ascending:false}).limit(100)
    ]);
    if(!r.error&&!d.error){
      requests=(r.data??[]) as RequestRow[];
      decisions=(d.data??[]) as DecisionRow[];
      accessible=true;
    }
   } catch{/* unavailable stays locked */}
 }
 const status=new Map(decisions.map(row=>[row.request_id,row]));
 return <AdminLayout status={accessible?"stable":"attention"}>
  <Card>
   <CardHeader><CardTitle>Финансовые заявки: возвраты и выплаты</CardTitle></CardHeader>
   <CardContent className="space-y-3 text-sm">
    <p>Это процесс согласования. Одобрение заявки не выполняет банковский перевод,
      не создаёт возврат и не признаёт прибыль.</p>
    <Badge variant="warning">Движение денежных средств — Не подтверждено</Badge>
   </CardContent>
  </Card>
  {args.result?<Card><CardContent className="p-4 text-sm">
    {args.result==="saved"?"Решение зафиксировано. Деньги не переведены.":
      "Действие отклонено. Проверьте права, основание и состояние заявки."}
    {args.result!=="saved"&&args.code?<span className="ml-2">{args.code}</span>:null}
  </CardContent></Card>:null}
  {!accessible?<Card><CardContent className="p-5 text-sm">
    Подключение к серверному финансовому журналу недоступно. Демонстрационные заявки не показаны.
  </CardContent></Card>:(
   <Card>
    <CardHeader><CardTitle>Последние заявки ({requests.length})</CardTitle></CardHeader>
    <CardContent className="space-y-3">
     {requests.length===0?<p className="text-sm text-muted">
       Пока нет заявок на возврат или выплату.</p>:requests.map(req=>{
        const decision=status.get(req.id);
        const selfApproval=req.requested_by===actor.data.userId;
        return <div key={req.id} className="space-y-3 rounded-lg border border-border bg-background p-4 text-sm">
         <div className="flex flex-wrap items-center gap-2">
          <Badge variant="info">{req.request_kind==="refund"?"Возврат":"Выплата партнёру"}</Badge>
          <Badge variant={decision?(decision.decision==="approved"?"success":"danger"):"warning"}>
           {decision?(decision.decision==="approved"?"Одобрено, не исполнено":"Отклонено"):"Ожидает решения"}
          </Badge>
          <b>{req.amount} {req.currency}</b>
         </div>
         <p className="text-muted">Обоснование: {req.reason}</p>
         <p className="break-all text-xs text-muted">ID заявки: {req.id}</p>
         {!decision && !selfApproval?<form action={decisionSubmit} className="grid gap-3">
          <input type="hidden" name="request_id" value={req.id}/>
          <label className="grid gap-2 font-medium">Основание решения
           <input name="decision_reference" minLength={8} maxLength={500} required
            placeholder="Документ, решение или номер согласования"
            className="w-full rounded-lg border border-border bg-surface p-3"/>
          </label>
          <div className="flex flex-wrap gap-2">
           <button type="submit" name="decision" value="approved"
            className="rounded-lg bg-primary px-4 py-2 font-semibold text-white">Одобрить заявку</button>
           <button type="submit" name="decision" value="rejected"
            className="rounded-lg border border-border px-4 py-2 font-semibold">Отклонить</button>
          </div>
         </form>:null}
         {selfApproval&&!decision?<p className="text-warning">Нельзя одобрить собственную заявку.</p>:null}
        </div>;
     })}
    </CardContent>
   </Card>
  )}
 </AdminLayout>;
}
