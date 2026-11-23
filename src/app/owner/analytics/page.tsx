import Link from "next/link";
import {redirect} from "next/navigation";
import {Container} from "@/components/ui/Container";
import {Badge} from "@/components/ui/Badge";
import {Card,CardContent,CardDescription,CardHeader,CardTitle} from "@/components/ui/Card";
import {requireSuperAdmin} from "@/lib/auth/roles";
import {currentBishkekFinanceMonth} from "@/lib/finance/report-period";
import {readOwnerOperationsAnalytics} from "@/lib/analytics/operations";

export const dynamic="force-dynamic";
export default async function OwnerOperationsAnalytics(){
 const actor=await requireSuperAdmin();
 if(!actor.ok)redirect("/not-authorized");
 const period=currentBishkekFinanceMonth();
 const result=await readOwnerOperationsAnalytics(period);
 const days=result.ok?result.data.daily.filter(d=>d.orders+d.bookings>0).slice(-12):[];
 const hours=result.ok?[...result.data.hourly_created_operations]
   .filter(h=>h.count>0).sort((a,b)=>b.count-a.count).slice(0,3):[];
 return <main className="min-h-screen bg-linear-to-br from-background via-lake-light/45 to-sand-light/60">
  <Container className="space-y-6 py-8">
   <Card>
    <CardHeader>
     <Badge variant="info">Собственник · Аналитика</Badge>
     <CardTitle className="text-2xl">Операционная аналитика KÖL</CardTitle>
     <CardDescription>Период {period.from} — {period.toExclusive} (последняя дата не включена), Asia/Bishkek.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-3 text-sm">
     <p>Только реальные записи базы. Суммы оформленных заявок не признаются доходом.</p>
     <div className="flex flex-wrap gap-3">
      <Link href="/owner" className="rounded-md border border-border p-3">Кабинет собственника</Link>
      <Link href="/admin/finance" className="rounded-md border border-border p-3">Финансовый журнал</Link>
      <Link href="/admin/finance/costs" className="rounded-md border border-border p-3">Учтённые расходы</Link>
     </div>
    </CardContent>
   </Card>
   {!result.ok?<Card><CardContent className="p-5 text-sm">
     Проверить операционные события сейчас не удалось. Демонстрационные показатели не подставляются.
    </CardContent></Card>:(
    <>
     <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Value label="Заказы" value={result.data.orders.count}/>
      <Value label="Брони" value={result.data.bookings.count}/>
      <Value label="Повторные клиенты в периоде" value={result.data.clients.repeat_in_period}/>
      <Value label="Доставки" value={result.data.deliveries.count}/>
      <Value label="Уникальные клиенты за период" value={result.data.clients.unique_in_period}/>
      <Value label="Выполненные заказы" value={result.data.orders.completed}/>
      <Value label="Выполненные брони" value={result.data.bookings.completed}/>
      <Value label="Обращения в поддержку" value={result.data.support.count}/>
     </section>
     <div className="grid gap-4 lg:grid-cols-2">
      <Card><CardHeader><CardTitle>Динамика операций</CardTitle>
       <CardDescription>Дни с зарегистрированными заказами и бронями.</CardDescription>
      </CardHeader>
       <CardContent className="space-y-2">
        {days.length?days.map(day=><p className="rounded-lg border border-border bg-background p-3 text-sm" key={day.date}>
         {day.date}: заказы {day.orders}, брони {day.bookings},
         завершено {day.completed_orders+day.completed_bookings}
        </p>):<p className="text-sm text-muted">За выбранный месяц операций нет.</p>}
       </CardContent>
      </Card>
      <Card><CardHeader><CardTitle>Активность и качество</CardTitle>
       <CardDescription>Час создания записей по времени Кыргызстана; это не посещаемость.</CardDescription>
      </CardHeader><CardContent className="space-y-2 text-sm">
       {hours.length?hours.map(h=><p className="rounded-lg border border-border bg-background p-3" key={h.hour}>
        {String(h.hour).padStart(2,"0")}:00 — {h.count} операций
       </p>):<p className="text-muted">Часовые данные отсутствуют.</p>}
       <p>Отменённые заказы: {result.data.orders.cancelled}.</p>
       <p>Отменённые брони: {result.data.bookings.cancelled}.</p>
       <p>Доставки повышенного риска: {result.data.deliveries.high_risk}.</p>
       <p>Повторные клиенты учитываются только внутри выбранного периода.</p>
      </CardContent></Card>
     </div>
     <Card className="border-warning/40 bg-warning/10"><CardHeader>
      <CardTitle>Маркетинговая конверсия и чистая прибыль — не подтверждены</CardTitle>
     </CardHeader><CardContent className="text-sm">
      Для конверсии нужны проверенные события посещений, для источников клиентов — достоверная атрибуция,
      для прибыли — полные расходы и финансовая сверка. Проценты не рассчитываются из неподходящих данных.
     </CardContent></Card>
    </>
   )}
  </Container>
 </main>;
}
function Value({label,value}:{label:string;value:number}){
 return <Card><CardContent className="p-5">
  <p className="text-sm text-muted">{label}</p>
  <p className="mt-2 text-3xl font-semibold">{value}</p>
 </CardContent></Card>;
}
