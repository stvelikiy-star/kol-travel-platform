import { AdminLayout } from "@/components/layout/AdminLayout";
import { readFinanceAdminSettlementPreview } from "@/lib/finance/settlement-preview";
import { readFinanceAdminJournalReport } from "@/lib/finance/journal";
import { currentBishkekFinanceMonth } from "@/lib/finance/report-period";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

const blockedFinanceAreas = [
  "Валовый оборот и выручка платформы",
  "Комиссия KÖL и договорные ставки",
  "Выплаты партнёрам и курьерам",
  "Возвраты, споры и корректировки",
  "Бухгалтерский учёт и экспорт"
];

const activationRequirements = [
  "Подтверждённый платёжный и финансовый источник истины",
  "Серверная проверка прав для финансовых операций",
  "Зафиксированные договорные комиссии и правила выплат",
  "Защита от повторного выполнения платежей, возвратов и выплат",
  "Журнал изменений и ручное подтверждение финансовых действий"
];

export default async function AdminFinancePage() {
  const period=currentBishkekFinanceMonth();
  const [preview,journal]=await Promise.all([
    readFinanceAdminSettlementPreview(period),
    readFinanceAdminJournalReport(period)
  ]);
  return (
    <AdminLayout status="attention">
      <Card className="overflow-hidden">
        <div className="bg-linear-to-br from-slate-900 via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">KÖL · Финансовый контроль</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Финансы платформы</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
            KÖL показывает финансовые показатели только тогда, когда они подтверждены платёжным и бухгалтерским контуром. Неподтверждённые комиссии, выплаты и возвраты не рассчитываются интерфейсом самостоятельно.
          </p>
        </div>
      </Card>

      <Card className="border-warning/40 bg-warning/10">
        <CardContent className="p-4 text-sm font-medium leading-6 text-foreground">
          Рабочий финансовый источник истины ещё не подключён для признания выручки, прибыли и реальных выплат. Ниже — отдельная проверяемая предварительная сводка из платёжных событий и договорных условий, если серверный источник доступен.
        </CardContent>
      </Card>


      <Card className="border-primary/25">
        <CardHeader>
          <CardTitle>Проверка расчётов · {period.from} — {period.toExclusive} (не включая дату окончания)</CardTitle>
          <CardDescription>
            Данные из Supabase, без демонстрационных сумм. Предварительная комиссия — не фактическая выручка KÖL.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {preview.ok ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg border border-border bg-background p-4"><p className="text-xs text-muted">Заказы и брони</p><p className="text-2xl font-semibold">{preview.data.counts.subjects}</p></div>
                <div className="rounded-lg border border-border bg-background p-4"><p className="text-xs text-muted">Платежи с подтверждением провайдера</p><p className="text-2xl font-semibold">{preview.data.counts.verified_paid_rows}</p></div>
                <div className="rounded-lg border border-border bg-background p-4"><p className="text-xs text-muted">Операции, пригодные для предварительного расчёта</p><p className="text-2xl font-semibold">{preview.data.counts.preview_eligible}</p></div>
                <div className="rounded-lg border border-border bg-background p-4"><p className="text-xs text-muted">Платежи без подходящих условий договора</p><p className="text-2xl font-semibold">{preview.data.counts.missing_terms}</p></div>
              </div>
              {preview.data.by_currency.length ? (
                <div className="space-y-2">
                  {preview.data.by_currency.map(item=><div className="rounded-lg border border-border bg-background p-4 text-sm" key={item.currency}>
                    <p className="font-semibold">{item.currency} · предварительно</p>
                    <p>Проверено платежей: {item.eligible_count}; сумма: {item.provider_verified_gross} {item.currency}</p>
                    <p>Расчёт комиссии по договору: {item.provisional_platform_fee} {item.currency}</p>
                    <p>Предварительная доля партнёров при сборе денег платформой: {item.provisional_partner_allocation_if_platform_collects} {item.currency}</p>
                    <p>Предварительная комиссия к получению от партнёров: {item.provisional_platform_receivable_if_partner_collects} {item.currency}</p>
                  </div>)}
                </div>
              ) : <p className="text-sm text-muted">Нет операций с подтверждённой оплатой, завершённой услугой и согласованным договором. Суммы не рассчитываются.</p>}
              <p className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-foreground">
                Прибыль, признанная выручка, задолженность и реальные выплаты не подтверждены. Операции не создаются этим экраном.
              </p>
            </>
          ) : (
            <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
              Серверный финансовый отчёт недоступен или роль не подтверждена. Ниже нет подстановки демонстрационных сумм.
            </p>
          )}
        </CardContent>
      </Card>


      <Card className="border-success/30">
        <CardHeader>
          <CardTitle>Зарегистрированные финансовые проводки</CardTitle>
          <CardDescription>
            Отчёт по дате признания в журнале, а не по дате заявки. Только подтверждённые проводки с двойной записью.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {journal.ok ? (
            <>
              <div className="rounded-lg border border-border bg-background p-4 text-sm">
                Записей в журнале: <strong>{journal.data.journal_count}</strong>.
                Дата признания: {journal.data.period_from} — {journal.data.period_to_exclusive} (конец не включён).
              </div>
              {journal.data.by_currency.length ? journal.data.by_currency.map(row=>(
                <div className="rounded-lg border border-border bg-background p-4 text-sm" key={row.currency}>
                  <p className="font-semibold">Признанная комиссия KÖL · {row.currency}</p>
                  <p>{row.recognized_platform_fee} {row.currency}, проводок: {row.recognitions}</p>
                  <p>Учётное обязательство перед партнёрами до выплат: {row.posted_partner_payable_before_payouts} {row.currency}</p>
                  <p>Учётное требование к партнёрам до оплат: {row.posted_partner_receivable_before_collections} {row.currency}</p>
                </div>
              )) : <p className="text-sm text-muted">Проводок за период нет. Это не означает, что все заявки оплачены или что прибыль равна нулю.</p>}
              <p className="text-sm text-muted">
                Денежный расчёт с банком, фактические выплаты и чистая прибыль — Не подтверждено.
              </p>
            </>
          ) : <p className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
            Журнал признанных операций недоступен. Показатели не заменяются демо-данными.
          </p>}
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {blockedFinanceAreas.map((label) => (
          <Card key={label}>
            <CardContent className="space-y-3 p-5">
              <p className="text-sm font-semibold text-foreground">{label}</p>
              <Badge variant="muted">Не подтверждено</Badge>
            </CardContent>
          </Card>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Почему суммы пока скрыты</CardTitle>
            <CardDescription>Заказ или бронь ещё не равны подтверждённой финансовой операции.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-muted">
            <p>Интерфейс не выводит комиссию из условного процента и не вычисляет выплаты из стоимости заказа.</p>
            <p>Статусы оплаты, возврата и выплаты должны поступать только из проверенного серверного финансового контура.</p>
            <p>Пока он не подключён, отсутствие данных отображается как «Не подтверждено», а не как фиктивная сумма.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Условия включения Finance</CardTitle>
            <CardDescription>Раздел станет рабочим после выполнения всех финансовых и контрольных условий.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {activationRequirements.map((item) => (
              <div className="rounded-md border border-border bg-background p-3 text-sm font-medium text-foreground" key={item}>
                {item}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="border-primary/25 bg-lake-light">
        <CardHeader>
          <CardTitle>Финансовые действия остаются под контролем человека</CardTitle>
          <CardDescription>
            Интерфейс и AI не создают выплаты, возвраты, споры, комиссии или бухгалтерские документы самостоятельно. Такие действия выполняются только через разрешённый финансовый процесс.
          </CardDescription>
        </CardHeader>
      </Card>
    </AdminLayout>
  );
}
