import { AdminLayout } from "@/components/layout/AdminLayout";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

const blockedFinanceAreas = [
  "GMV и выручка платформы",
  "Комиссия KÖL и договорные ставки",
  "Выплаты партнёрам и курьерам",
  "Возвраты, споры и корректировки",
  "Бухгалтерский ledger и экспорт"
];

const activationRequirements = [
  "Подтверждённый payment/ledger источник истины",
  "Серверные роли и RLS для finance/admin операций",
  "Зафиксированные договорные комиссии и правила выплат",
  "Идемпотентные payment/refund/payout операции",
  "Audit log и ручное подтверждение финансовых изменений"
];

export default function AdminFinancePage() {
  return (
    <AdminLayout status="attention">
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-slate-900 via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">Finance locked</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Финансы платформы</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
            Финансовый раздел работает fail-closed: интерфейс не рассчитывает и не показывает неподтверждённые GMV, комиссии, выплаты или возвраты.
          </p>
        </div>
      </Card>

      <Card className="border-warning/40 bg-warning/10">
        <CardContent className="p-4 text-sm font-medium leading-6 text-foreground">
          Финансовый ledger ещё не подключён как подтверждённый источник истины. Поэтому суммы не заменяются mock-данными, расчётными коэффициентами или значением 0.
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
            <CardTitle>Почему суммы скрыты</CardTitle>
            <CardDescription>Операционный заказ или бронь сами по себе не являются финансовым ledger.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-muted">
            <p>Интерфейс не выводит комиссию из условного процента и не вычисляет выплаты из стоимости заказа.</p>
            <p>Статусы оплаты, возврата и выплаты должны поступать только из проверенного серверного финансового контура.</p>
            <p>Пока такого контура нет, отсутствие данных отображается как «Не подтверждено», а не как фиктивная сумма.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Условия включения Finance</CardTitle>
            <CardDescription>Раздел можно активировать только после выполнения всех контрактов.</CardDescription>
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

      <Card className="border-danger/30 bg-danger/10">
        <CardHeader>
          <CardTitle>Финансовые изменения отключены</CardTitle>
          <CardDescription>
            UI не создаёт выплаты, возвраты, споры, комиссии или бухгалтерские документы. AI также не меняет финансовые статусы.
          </CardDescription>
        </CardHeader>
      </Card>
    </AdminLayout>
  );
}
