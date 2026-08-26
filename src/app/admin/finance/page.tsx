import { AdminLayout } from "@/components/layout/AdminLayout";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

const blockedFinanceAreas = [
  "GMV и выручка платформы",
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

export default function AdminFinancePage() {
  return (
    <AdminLayout status="attention">
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-slate-900 via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">KÖL Finance Control</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Финансы платформы</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
            KÖL показывает финансовые показатели только тогда, когда они подтверждены платёжным и бухгалтерским контуром. Неподтверждённые комиссии, выплаты и возвраты не рассчитываются интерфейсом самостоятельно.
          </p>
        </div>
      </Card>

      <Card className="border-warning/40 bg-warning/10">
        <CardContent className="p-4 text-sm font-medium leading-6 text-foreground">
          Рабочий финансовый источник истины ещё не подключён. Поэтому вместо условных расчётов или демонстрационных сумм раздел честно показывает статус «Не подтверждено».
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
