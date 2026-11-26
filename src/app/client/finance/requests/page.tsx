import {redirect} from "next/navigation";
import {ClientLayout} from "@/components/layout/ClientLayout";
import {Badge} from "@/components/ui/Badge";
import {Card,CardContent,CardDescription,CardHeader,CardTitle} from "@/components/ui/Card";
import {requireClient} from "@/lib/auth/roles";
import {readOwnRefundSources,readOwnRefundRequestHistory} from "@/lib/finance/requests-read";
import {submitFinanceRequest} from "@/app/actions/admin/finance-requests";

export const dynamic="force-dynamic";
async function requestRefund(form:FormData):Promise<never>{
 "use server";
 const result=await submitFinanceRequest(form);
 redirect("/client/finance/requests?result="+(result.ok?"saved":"error"));
}
export default async function ClientRefundRequestsPage({
 searchParams
}:{searchParams:Promise<{result?:string}>}){
 const user=await requireClient();
 if(!user.ok)redirect("/not-authorized");
 const [source,history,params]=await Promise.all([readOwnRefundSources(),readOwnRefundRequestHistory(),searchParams]);
 return <ClientLayout>
  <Card>
   <CardHeader><Badge variant="info">Возвраты</Badge><CardTitle>Запросить возврат</CardTitle>
    <CardDescription>Только ваши оплаченные заказы и бронирования. Отправка заявки не возвращает деньги автоматически.</CardDescription>
   </CardHeader>
  </Card>
  {params.result?<Card><CardContent className="p-4 text-sm">
   {params.result==="saved"?"Заявка зарегистрирована и ожидает решения. Деньги не перечислены.":
   "Запрос не принят. Проверьте операцию или наличие ранее созданной заявки."}
  </CardContent></Card>:null}
  <Card>
   <CardHeader><CardTitle>История финансовых заявок</CardTitle><CardDescription>Последние 100 заявок и решения по ним. Одобрение не означает перевод денег.</CardDescription></CardHeader>
   <CardContent className="space-y-3 text-sm">
    {!history.ok?<p className="text-muted">История заявок недоступна.</p>:history.rows.length===0?<p className="text-muted">Заявок пока нет.</p>:history.rows.map(row=>
     <div key={row.id} className="rounded-lg border border-border bg-background p-3">
      <div className="flex flex-wrap items-center gap-2"><strong>{row.amount} {row.currency}</strong>
       <Badge variant={row.decision==="approved"?"success":row.decision==="rejected"?"danger":"warning"}>{row.decision==="approved"?"Одобрено, не исполнено":row.decision==="rejected"?"Отклонено":"Ожидает решения"}</Badge>
      </div>
      <p className="text-muted">{new Date(row.requested_at).toLocaleDateString("ru-RU",{timeZone:"Asia/Bishkek"})}</p>
      <p className="break-all text-xs text-muted">ID заявки: {row.id}</p>
     </div>)}
   </CardContent>
  </Card>
  {!source.ok?<Card><CardContent className="p-4 text-sm">
   Проверить ваши платежи не удалось. Демонстрационные операции не подставляются.
  </CardContent></Card>:(
   <Card>
    <CardHeader><CardTitle>Мои оплаченные операции</CardTitle>
      <CardDescription>Последние доступные операции, максимум 100. Каждую заявку проверяет сервер.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
     {!source.rows.length?<p className="text-sm text-muted">Подтверждённых оплат для запроса возврата пока нет.</p>:
      source.rows.filter(p=>!history.ok||!history.rows.some(r=>r.payment_id===p.id)).map(p=><form action={requestRefund} key={p.id}
       className="space-y-3 rounded-lg border border-border bg-background p-4">
       <div className="flex flex-wrap gap-2 text-sm">
        <Badge variant="info">{p.subject_type==="order"?"Заказ":"Бронирование"}</Badge>
        <strong>{p.amount} KGS</strong>
       </div>
       <p className="break-all text-xs text-muted">Платёж {p.id}</p>
       <input type="hidden" name="request_kind" value="refund"/>
       <input type="hidden" name="source_id" value={p.id}/>
       <input type="hidden" name="idempotency_key" value={"refund:"+p.id}/>
       <label className="grid gap-2 text-sm">Сумма возврата
        <input type="number" name="amount" min="0.01" max={p.amount}
         step="0.01" defaultValue={p.amount} required
         className="w-full rounded-md border border-border bg-surface p-3"/>
       </label>
       <label className="grid gap-2 text-sm">Причина обращения
        <textarea name="reason" minLength={8} maxLength={1000} rows={2} required
         placeholder="Опишите причину возврата"
         className="w-full rounded-md border border-border bg-surface p-3"/>
       </label>
       <button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white" type="submit">
        Отправить заявку
       </button>
      </form>)}
    </CardContent>
   </Card>
  )}
  <Card><CardContent className="p-4 text-sm text-muted">
   Решение о возврате принимает уполномоченный сотрудник. Факт возврата подтверждается платёжной системой отдельно.
  </CardContent></Card>
 </ClientLayout>;
}
