import { PartnerLayout } from "@/components/layout/PartnerLayout";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

const financeFields = [
  { label: "Подтверждённая выручка", note: "Требуется финансовый ledger." },
  { label: "Комиссия KÖL", note: "Ставка должна поступать из договора/настроек, а не из UI." },
  { label: "К выплате", note: "Требуется подтверждённый payout balance." },
  { label: "Выплачено", note: "Требуется история фактических payout операций." }
];

export default function PartnerFinancePage() {
  return (
    <PartnerLayout>
      <section className="space-y-6">
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-5">
          <Badge variant="warning">Finance locked</Badge>
          <h2 className="mt-3 text-2xl font-semibold text-foreground">Финансы</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            Финансовый контур партнёра ещё не подключён. Неподтверждённые комиссии, выплаты и выручка не рассчитываются из заказов или броней на стороне интерфейса.
          </p>
        </div>

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
              <p>Статус оплаты клиента не используется для вычисления payout balance без отдельного ledger.</p>
              <p>Запрос выплаты отключён, пока нет серверной операции с ролью, идемпотентностью и audit log.</p>
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
