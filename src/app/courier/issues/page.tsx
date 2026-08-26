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
          <Badge className="border-white/30 bg-white text-primary">KÖL Courier Support</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Проблемы доставки</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
            Курьер сможет передать проблему по конкретной доставке в операционную очередь KÖL. Пока рабочий канал эскалации не подключён, система не создаёт вымышленные обращения и статусы.
          </p>
        </div>
      </Card>

      <Card className="border-warning/40 bg-warning/10">
        <CardContent className="p-4 text-sm font-medium leading-6 text-foreground">
          Отправка обращения пока недоступна. Для запуска нужны подтверждённая доставка текущего курьера, категория проблемы, приоритет, время события и запись операции в журнал изменений.
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader>
            <CardTitle>Категории проблем</CardTitle>
            <CardDescription>Эти категории будут использоваться для быстрой маршрутизации обращения нужному администратору.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {issueGroups.map((item) => (
              <div className="rounded-md border border-border bg-background p-4 text-sm font-semibold text-foreground" key={item}>{item}</div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-primary/25 bg-lake-light">
          <CardHeader>
            <CardTitle>Что остаётся под контролем администратора</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <Rule>Курьер не меняет статус оплаты.</Rule>
            <Rule>Проблема на доставке не отменяет заказ автоматически.</Rule>
            <Rule>Возвраты и спорные деньги проходят через финансовый и административный контур.</Rule>
            <Rule>Критические инциденты требуют решения человека.</Rule>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <Badge className="w-fit" variant="muted">Следующий этап</Badge>
          <CardTitle>Рабочая форма обращения</CardTitle>
          <CardDescription>После подключения серверного канала форма будет проверять принадлежность доставки текущему курьеру и сохранять обращение вместе с историей изменений.</CardDescription>
        </CardHeader>
      </Card>
    </CourierLayout>
  );
}

function Rule({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border border-border bg-surface p-3 font-medium leading-6 text-foreground">{children}</div>;
}
