import { PartnerLayout } from "@/components/layout/PartnerLayout";
import { readPartnerSettlementPreview } from "@/lib/finance/settlement-preview";
import { readPartnerJournalReport } from "@/lib/finance/journal";
import { currentBishkekFinanceMonth } from "@/lib/finance/report-period";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

const financeFields = [
  { label: "Подтверждённая выручка", note: "Требуется финансовый журнал." },
  { label: "Комиссия KÖL", note: "Ставка берётся из договора или серверных настроек, а не рассчитывается интерфейсом." },
  { label: "К выплате", note: "Требуется подтверждённый остаток к выплате." },
  { label: "Выплачено", note: "Требуется история фактических выплат." }
];

export default async function PartnerFinancePage() {
  const period=currentBishkekFinanceMonth();
  const [preview,journal]=await Promise.all([
    readPartnerSettlementPreview(period),
    readPartnerJournalReport(period)
  ]);
  return (
    <PartnerLayout>
      <section className="space-y-6">
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-5">
          <Badge variant="warning">Финансовые операции ограничены</Badge>
          <h2 className="mt-3 text-2xl font-semibold text-foreground">Финансы</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            Финансовый контур партнёра ещё не подключён. Неподтверждённые комиссии, выплаты и выручка не рассчитываются из заказов или броней на стороне интерфейса.
          </p>
        </div>


        <Card>
          <CardHeader>
            <CardTitle>Мои операции — текущий месяц</CardTitle>
            <CardDescription>
              Только ваш бизнес. Показатели основаны на данных PostgreSQL; расчёт комиссии предварительный.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {preview.ok ? (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-border bg-background p-4">
                    <p className="text-xs text-muted">Заказы и брони</p><p className="text-2xl font-semibold">{preview.data.counts.subjects}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-background p-4">
                    <p className="text-xs text-muted">Подтверждённые платежи</p><p className="text-2xl font-semibold">{preview.data.counts.verified_paid_rows}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-background p-4">
                    <p className="text-xs text-muted">Предварительные расчёты</p><p className="text-2xl font-semibold">{preview.data.counts.preview_eligible}</p>
                  </div>
                </div>
                {preview.data.by_currency.length?preview.data.by_currency.map(x=>(
                  <p className="rounded-lg border border-border bg-background p-3 text-sm" key={x.currency}>
                    {x.currency}: проверенный оборот {x.provider_verified_gross}, предварительная комиссия KÖL {x.provisional_platform_fee}.
                    Это не подтверждённая сумма к выплате.
                  </p>
                )):<p className="text-sm text-muted">Подтверждённых операций для расчёта пока нет. Комиссия и долг не выводятся из стоимости заявки.</p>}
              </>
            ) : <p className="text-sm text-muted">
              Проверяемая финансовая сводка недоступна. Данные другого партнёра не подставляются.
            </p>}
          </CardContent>
        </Card>


        <Card>
          <CardHeader>
            <CardTitle>Мои зарегистрированные проводки</CardTitle>
            <CardDescription>
              Только операции вашего бизнеса по дате признания; не является подтверждением банковской выплаты.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {journal.ok ? (
              <>
                <p>Подтверждённых проводок: <strong>{journal.data.journal_count}</strong>.</p>
                {journal.data.by_currency.length?journal.data.by_currency.map(row=>(
                  <div className="rounded-lg border border-border bg-background p-3" key={row.currency}>
                    <p>Признанная комиссия KÖL: <strong>{row.recognized_platform_fee} {row.currency}</strong>.</p>
                    <p>Учётное обязательство перед партнёром до выплат: {row.posted_partner_payable_before_payouts} {row.currency}.</p>
                    <p>Требование к партнёру до оплат: {row.posted_partner_receivable_before_collections} {row.currency}.</p>
                  </div>
                )):<p className="text-muted">За текущий месяц проводок нет. Выплаты и прибыль — Не подтверждено.</p>}
              </>
            ) : <p className="text-muted">Журнал операций недоступен. Пустые суммы не подставляются.</p>}
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {financeFields.map((field) => (
            <Card key={field.label}>
              <CardContent className="space-y-3 p-5">
                <p className="text-sm font-semibold text-foreground">{field.label}</p>
                <Badge variant="muted">Не подтверждено</Badge>
                <p className="text-sm leading-6 text-muted">{field.note}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Транзакции и выплаты</CardTitle>
              <CardDescription>Не отображаются до подключения подтверждённого финансового источника.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-muted">
              <p>Заказ или бронь не считаются фактом выплаты партнёру.</p>
              <p>Статус оплаты клиента не используется для расчёта остатка к выплате без отдельного финансового журнала.</p>
              <p>Запрос выплаты отключён, пока нет серверной операции с проверкой роли, защитой от повторного исполнения и журналом действий.</p>
            </CardContent>
          </Card>

          <Card className="border-warning/40 bg-warning/10">
            <CardHeader>
              <CardTitle>Комиссия платформы</CardTitle>
              <CardDescription>UI не содержит условной процентной ставки.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-muted">
              <p>Фактическая комиссия должна определяться подтверждёнными коммерческими условиями партнёра и серверной финансовой логикой.</p>
              <Badge variant="muted">Ставка не подтверждена</Badge>
            </CardContent>
          </Card>
        </div>

        <Card className="border-danger/30 bg-danger/10">
          <CardHeader>
            <CardTitle>Финансовые действия отключены</CardTitle>
            <CardDescription>
              Этот экран не создаёт выплат, не меняет payment status и не формирует финансовые документы.
            </CardDescription>
          </CardHeader>
        </Card>
      </section>
    </PartnerLayout>
  );
}
