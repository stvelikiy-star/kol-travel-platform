import { CourierLayout } from "@/components/layout/CourierLayout";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

const earningFields = [
  "Начислено сегодня",
  "Начислено за неделю",
  "К выплате",
  "Выплачено"
];

export default function CourierEarningsPage() {
  return (
    <CourierLayout status="online">
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-secondary via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">Courier finance locked</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Доход курьера</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
            Расчёт начислений и выплат ещё не подключён к подтверждённому финансовому ledger. Интерфейс не подставляет условные тарифы или суммы.
          </p>
        </div>
      </Card>

      <Card className="border-warning/40 bg-warning/10">
        <CardContent className="p-4 text-sm font-medium leading-6 text-foreground">
          Пока серверный расчёт дохода не подтверждён, все финансовые значения остаются «Не подтверждено», а запросы выплат отключены.
        </CardContent>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {earningFields.map((field) => (
          <Card key={field}>
            <CardContent className="space-y-3 p-5">
              <p className="text-sm font-semibold text-foreground">{field}</p>
              <Badge variant="muted">Не подтверждено</Badge>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Из чего должен складываться доход</CardTitle>
            <CardDescription>Только из серверных тарифов и подтверждённых фактов доставки.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-muted">
            <p>Базовая ставка, расстояние, бонусы и удержания не задаются в интерфейсе.</p>
            <p>Завершённая доставка не превращается автоматически в произвольную фиксированную сумму.</p>
            <p>Каждое начисление должно иметь серверное основание и быть связано с конкретной доставкой.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>История выплат</CardTitle>
            <CardDescription>Недоступна до появления подтверждённых payout операций.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-muted">
            <p>UI не создаёт фиктивные payout ID, даты, статусы или суммы.</p>
            <p>Запрос выплаты появится только вместе с серверной проверкой роли, баланса, идемпотентностью и audit log.</p>
          </CardContent>
        </Card>
      </section>

      <Card className="border-danger/30 bg-danger/10">
        <CardHeader>
          <CardTitle>Выплаты отключены</CardTitle>
          <CardDescription>
            Этот экран не инициирует перевод денег и не изменяет финансовые статусы.
          </CardDescription>
        </CardHeader>
      </Card>
    </CourierLayout>
  );
}
