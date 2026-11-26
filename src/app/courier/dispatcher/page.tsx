import { CourierLayout } from "@/components/layout/CourierLayout";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

const capabilities = [
  "Анализировать подтверждённые события доставки после подключения потока событий.",
  "Показывать задержки только по утверждённым нормативам обслуживания.",
  "Готовить рекомендации администратору без автоматического выполнения опасных действий.",
  "Формировать черновик уведомления на основании фактических данных."
];

const blocked = [
  "Не отменяет заказ самостоятельно.",
  "Не меняет статус оплаты.",
  "Не подтверждает возвраты или выплаты.",
  "Не переназначает курьера без разрешённой серверной операции.",
  "Не выдумывает нормативы обслуживания, адреса, время прибытия, контакты или задержки.",
  "Не включает продажу алкоголя."
];

export default function CourierDispatcherPage() {
  return (
    <CourierLayout status="online">
      <Card className="overflow-hidden">
        <div className="bg-linear-to-br from-secondary via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">Правила ИИ-диспетчера</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">AI-диспетчер доставки</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
            Экран фиксирует безопасный контракт будущего AI-диспетчера. Он не показывает вымышленные рекомендации, риски или таймеры как реальные операционные данные.
          </p>
        </div>
      </Card>

      <Card className="border-warning/40 bg-warning/10">
        <CardContent className="p-4 text-sm font-medium leading-6 text-foreground">
          Live dispatcher пока не подключён. Конкретные минуты SLA, правила reassignment и автоматические уведомления должны появиться только после подтверждения бизнес-правил и серверного event/audit контура.
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Разрешённые возможности</CardTitle>
            <CardDescription>Только после появления подтверждённых источников данных.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            {capabilities.map((item) => <Rule key={item}>{item}</Rule>)}
          </CardContent>
        </Card>

        <Card className="border-danger/30 bg-danger/10">
          <CardHeader>
            <CardTitle>Жёсткие ограничения</CardTitle>
            <CardDescription>Эти действия нельзя выполнять по совету ИИ без защищённого серверного контроля.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            {blocked.map((item) => <Rule key={item}>{item}</Rule>)}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <Badge className="w-fit" variant="muted">Нет активных рекомендаций</Badge>
          <CardTitle>Что требуется до включения</CardTitle>
          <CardDescription>Назначенные активные доставки, время событий, утверждённые нормативы, подтверждение администратора, журнал действий и уведомления.</CardDescription>
        </CardHeader>
      </Card>
    </CourierLayout>
  );
}

function Rule({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border border-border bg-background p-3 font-medium text-foreground">{children}</div>;
}
