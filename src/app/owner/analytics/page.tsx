import {FinanceMonthFilter} from "@/components/finance/FinanceMonthFilter";
import Link from "next/link";
import {redirect} from "next/navigation";
import {Container} from "@/components/ui/Container";
import {Badge} from "@/components/ui/Badge";
import {Card,CardContent,CardDescription,CardHeader,CardTitle} from "@/components/ui/Card";
import {requireSuperAdmin} from "@/lib/auth/roles";
import {selectBishkekFinanceMonth} from "@/lib/finance/report-period";
import {readOwnerOperationsAnalytics} from "@/lib/analytics/operations";
import {readOwnerJournalReport} from "@/lib/finance/journal";
import {createSupabaseServiceRoleClient} from "@/lib/supabase/service-role";
import {isSupabaseMode} from "@/lib/data/data-source";
import type {FinancePeriod} from "@/lib/finance/analytics";

type CostRow={currency:string;recognized_expense_activity:number};
async function readOwnerCosts(period:FinancePeriod):Promise<CostRow[]|null>{
 if(!isSupabaseMode())return null;
 try{
  const db=createSupabaseServiceRoleClient();
  const {data,error}=await db.rpc("kol_finance_cost_report_v1",{p_from:period.from,p_to:period.toExclusive,p_business_id:null});
  if(error||!data||data.kind!=="owner_attested_expense_activity"||data.schema_version!==1||
     data.business_id!==null||data.period_from!==period.from||data.period_to_exclusive!==period.toExclusive||
     !Array.isArray(data.by_currency)||!data.by_currency.every((x:CostRow)=>x&&typeof x.currency==="string"&&/^[A-Z]{3}$/.test(x.currency)&&Number.isFinite(x.recognized_expense_activity)))return null;
  return data.by_currency as CostRow[];
 }catch{return null;}
}
function money(amount:number){
 return Number.isFinite(amount)?new Intl.NumberFormat("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:2}).format(amount):"—";
}
function accruedDifference(revenue:number,cost:number){
 const r=Math.round(revenue*100),c=Math.round(cost*100);
 return Number.isSafeInteger(r)&&Number.isSafeInteger(c)&&Number.isSafeInteger(r-c)?money((r-c)/100):"—";
}

export const dynamic="force-dynamic";
export default async function OwnerOperationsAnalytics({searchParams}:{searchParams:Promise<{month?:string}>}){
 const actor=await requireSuperAdmin();
 if(!actor.ok)redirect("/not-authorized");
 const period=selectBishkekFinanceMonth((await searchParams).month);
 const [result,journal,costs]=await Promise.all([readOwnerOperationsAnalytics(period),readOwnerJournalReport(period),readOwnerCosts(period)]);
 const currencies=journal.ok&&costs!==null?Array.from(new Set([...journal.data.by_currency.map(x=>x.currency),...costs.map(x=>x.currency)])).sort():[];
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
   <FinanceMonthFilter period={period}/>
   <Card>
    <CardHeader>
     <CardTitle>Финансовый результат по учтённым операциям</CardTitle>
     <CardDescription>Выбранный месяц · отдельно по каждой валюте</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4 text-sm">
     {journal.ok&&costs!==null?(currencies.length?currencies.map(currency=>{
      const row=journal.data.by_currency.find(x=>x.currency===currency);
      const revenue=row?.recognized_platform_fee??0;
      const cost=costs.find(x=>x.currency===currency)?.recognized_expense_activity??0;
      return <section key={currency} className="space-y-3 rounded-lg border border-border bg-background p-4">
       <h3 className="font-semibold">{currency}</h3>
       <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div><p className="text-muted">Признанная комиссия</p><strong className="text-xl">{money(revenue)} {currency}</strong></div>
        <div><p className="text-muted">Начисленные расходы</p><strong className="text-xl">{money(cost)} {currency}</strong></div>
        <div><p className="text-muted">Результат по проведённым записям</p><strong className="text-xl">{accruedDifference(revenue,cost)} {currency}</strong></div>
        <div><p className="text-muted">Подтверждённый оборот по проводкам</p><strong>{money(row?.verified_provider_gross??0)} {currency}</strong></div>
        <div><p className="text-muted">Начислено партнёрам до выплат</p><strong>{money(row?.posted_partner_payable_before_payouts??0)} {currency}</strong></div>
        <div><p className="text-muted">Начислено к получению от партнёров до оплат</p><strong>{money(row?.posted_partner_receivable_before_collections??0)} {currency}</strong></div>
       </div>
      </section>;
     }):<p className="text-muted">За период нет признанных доходов и начисленных расходов.</p>):<p className="text-muted">Финансовая сводка недоступна.</p>}
     <p className="text-muted">Разница признанных комиссий и начисленных расходов не является чистой прибылью: налоги, полнота затрат и банковские расчёты учитываются отдельно.</p>
     <Link href="/admin/finance" className="inline-flex rounded-lg border border-border px-4 py-3 font-semibold text-primary">Открыть финансовый раздел</Link>
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
