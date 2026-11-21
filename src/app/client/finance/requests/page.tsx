import {redirect} from "next/navigation";
import {ClientLayout} from "@/components/layout/ClientLayout";
import {Badge} from "@/components/ui/Badge";
import {Card,CardContent,CardDescription,CardHeader,CardTitle} from "@/components/ui/Card";
import {requireClient} from "@/lib/auth/roles";
import {readOwnRefundSources} from "@/lib/finance/requests-read";
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
 const [source,params]=await Promise.all([readOwnRefundSources(),searchParams]);
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
  {!source.ok?<Card><CardContent className="p-4 text-sm">
   Проверить ваши платежи не удалось. Демонстрационные операции не подставляются.
  </CardContent></Card>:(
   <Card>
    <CardHeader><CardTitle>Мои оплаченные операции</CardTitle>
      <CardDescription>Последние доступные операции, максимум 100. Каждую заявку проверяет сервер.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
     {!source.rows.length?<p className="text-sm text-muted">Подтверждённых оплат для запроса возврата пока нет.</p>:
      source.rows.map(p=><form action={requestRefund} key={p.id}
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
