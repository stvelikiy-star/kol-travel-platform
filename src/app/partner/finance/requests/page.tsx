import {redirect} from "next/navigation";
import {PartnerLayout} from "@/components/layout/PartnerLayout";
import {Badge} from "@/components/ui/Badge";
import {Card,CardContent,CardDescription,CardHeader,CardTitle} from "@/components/ui/Card";
import {requireRole} from "@/lib/auth/roles";
import {readOwnPayoutSources,readOwnPayoutRequestHistory} from "@/lib/finance/requests-read";
import {submitFinanceRequest} from "@/app/actions/admin/finance-requests";

export const dynamic="force-dynamic";
async function requestPayout(form:FormData):Promise<never>{
 "use server";
 const result=await submitFinanceRequest(form);
 redirect("/partner/finance/requests?result="+(result.ok?"saved":"error"));
}
export default async function PartnerPayoutRequestPage({
 searchParams
}:{searchParams:Promise<{result?:string}>}){
 const actor=await requireRole(["partner_owner","partner_manager"]);
 if(!actor.ok)redirect("/not-authorized");
 const [source,history,params]=await Promise.all([readOwnPayoutSources(),readOwnPayoutRequestHistory(),searchParams]);
 const available=source.ok?source.rows.filter(row=>history.ok&&!history.rows.some(r=>r.journal_id===row.id)):[];
 return <PartnerLayout>
  <Card>
   <CardHeader><Badge variant="warning">Финансы · согласование</Badge><CardTitle>Заявки на выплату</CardTitle>
    <CardDescription>Ваши обязательства в подтверждённом журнале. Одобрение собственника не означает банковский перевод.</CardDescription>
   </CardHeader>
  </Card>
  {params.result?<Card><CardContent className="p-4 text-sm">
    {params.result==="saved"?"Заявка передана на согласование. Деньги не перечислены.":
      "Заявка не принята. Возможно, по этой операции уже есть обращение."}
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
  {!source.ok||!history.ok?<Card><CardContent className="p-4 text-sm">
    Подтверждённые финансовые обязательства сейчас недоступны. Демонстрационные суммы не выводятся.
  </CardContent></Card>:(
   <Card>
    <CardHeader><CardTitle>Доступные зарегистрированные обязательства</CardTitle>
     <CardDescription>Только ваш бизнес, максимум 100 последних записей.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      {!available.length?<p className="text-sm text-muted">
        Нет зарегистрированных сумм для заявки. Стоимость заказа не является подтверждённой выплатой.
      </p>:available.map(row=><form action={requestPayout}
       key={row.id} className="space-y-3 rounded-lg border border-border bg-background p-4">
       <div className="flex flex-wrap gap-2 text-sm"><Badge variant="info">Учётное обязательство</Badge>
        <strong>{row.partner_allocation} {row.currency}</strong></div>
       <p className="break-all text-xs text-muted">Проводка {row.id}</p>
       <input name="request_kind" type="hidden" value="payout"/>
       <input name="source_id" type="hidden" value={row.id}/>
       <input name="idempotency_key" type="hidden" value={"payout:"+row.id}/>
       <input name="amount" type="hidden" value={row.partner_allocation}/>
       <label className="grid gap-2 text-sm">Основание заявки
        <textarea name="reason" minLength={8} maxLength={1000} rows={2} required
         placeholder="Укажите основание для согласования"
         className="w-full rounded-md border border-border bg-surface p-3"/>
       </label>
       <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">
        Запросить выплату
       </button>
      </form>)}
    </CardContent>
   </Card>
  )}
  <Card><CardContent className="p-4 text-sm text-muted">
    Платёж инициируется отдельно после решения и проверки банковских реквизитов.
    Этот раздел не исполняет перевод и не изменяет платёжные записи.
  </CardContent></Card>
 </PartnerLayout>;
}
