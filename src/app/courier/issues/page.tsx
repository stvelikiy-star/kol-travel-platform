import { CourierLayout } from "@/components/layout/CourierLayout";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

const issueGroups = [
  "Проблема у партнёра или при выдаче",
  "Проблема с адресом или доступностью клиента",
  "Проблема с комплектацией или повреждением",
  "Проблема маршрута, транспорта или безопасности",
  "Платёжный или отменный вопрос — только через администратора"
];

export default function CourierIssuesPage() {
  return (
    <CourierLayout status="online">
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-secondary via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">Issue escalation locked</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Проблемы доставки</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
            KÖL не показывает вымышленные tickets и не делает вид, что форма отправляет проблему. До подключения escalation backend страница работает fail-closed.
          </p>
        </div>
      </Card>

      <Card className="border-warning/40 bg-warning/10">
        <CardContent className="p-4 text-sm font-medium leading-6 text-foreground">
          Создание issue требует server-side операции с courier assignment, delivery ID, категорией, severity, timestamp и audit log. High-risk действия не меняют заказ или оплату автоматически.
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader>
            <CardTitle>Категории эскалации</CardTitle>
            <CardDescription>Это классификация будущего backend, а не список уже созданных обращений.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {issueGroups.map((item) => (
              <div className="rounded-md border border-border bg-background p-4 text-sm font-semibold text-foreground" key={item}>{item}</div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-danger/30 bg-danger/10">
          <CardHeader>
            <CardTitle>Ограничения courier issue flow</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <Rule>Курьер не меняет payment status.</Rule>
            <Rule>Курьер не отменяет заказ через issue form.</Rule>
            <Rule>Refund и спорные деньги требуют finance/admin контура.</Rule>
            <Rule>Критические инциденты требуют human admin.</Rule>
            <Rule>ALCOHOL_MODULE_ENABLED остаётся false.</Rule>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <Badge className="w-fit" variant="muted">write disabled</Badge>
          <CardTitle>Форма обращения не активирована</CardTitle>
          <CardDescription>
            Появится после server-side RPC/API, который проверяет принадлежность доставки текущему курьеру и сохраняет audit trail.
          </CardDescription>
        </CardHeader>
      </Card>
    </CourierLayout>
  );
}

function Rule({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border border-danger/20 bg-surface p-3 font-medium text-foreground">{children}</div>;
}
