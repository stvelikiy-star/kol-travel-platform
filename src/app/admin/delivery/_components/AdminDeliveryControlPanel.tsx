import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

type AdminDeliveryControlPanelProps = {
  context: "delivery" | "ai-dispatcher";
};

const contextCopy: Record<AdminDeliveryControlPanelProps["context"], { title: string; description: string }> = {
  delivery: {
    title: "Контроль доставки",
    description:
      "Контроль задержанных заказов, готовности партнёров, назначения курьеров и проблем доставки."
  },
  "ai-dispatcher": {
    title: "AI-диспетчер рекомендует",
    description:
      "ИИ-диспетчер выявляет задержки, оценивает риски и предлагает действия, но не принимает критические решения."
  }
};

const deliveryStages = [
  "Новый заказ",
  "Принят партнёром",
  "Готовится",
  "Готов к выдаче",
  "Курьер назначен",
  "Курьер едет к партнёру",
  "Заказ получен",
  "Курьер едет к клиенту",
  "Доставлено",
  "Проблема зарегистрирована",
  "Требуется администратор"
];

const attentionBlocks = [
  "Заказы требуют внимания",
  "Готово к выдаче",
  "Курьер не назначен",
  "Курьер задерживается",
  "Партнёр не готов",
  "Клиент не отвечает",
  "Проблема на маршруте",
  "Нужна ручная проверка",
  "Высокий риск"
];

const adminCan = [
  "Просмотр задержанных заказов",
  "Проверка готовности партнёра",
  "Просмотр назначения курьера",
  "Оценка важности проблемы доставки",
  "Проверка рекомендации ИИ",
  "Решение о ручном вмешательстве",
  "Подготовка переназначения курьера",
  "Подготовка решения проблемы"
];

const highRiskActions = [
  "Отмена принятого заказа",
  "Отмена после выдачи заказа",
  "Изменение статуса оплаты",
  "Подтверждение возврата средств",
  "Принудительное завершение заказа",
  "Принудительное закрытие проблемы доставки",
  "Переназначение курьера после выдачи",
  "Блокировка партнёра",
  "Блокировка курьера",
  "Запрос на продажу алкоголя"
];

const aiCannot = [
  "ИИ не может отменить заказ",
  "AI cannot Изменение статуса оплаты",
  "AI cannot Подтверждение возврата средств",
  "ИИ не может включить продажу алкоголя",
  "Критические действия требуют подтверждения администратора"
];

const aiCan = [
  "ИИ может выявлять задержки",
  "ИИ может оценивать важность проблем",
  "ИИ может рекомендовать переназначение",
  "ИИ может готовить сообщения",
  "ИИ может уведомлять администратора"
];

const riskLevels = [
  "Низкий риск: только информация",
  "Средний риск: задержка или уточнение",
  "Высокий риск: заказ или доставка заблокированы",
  "Критический риск: оплата, возврат, отмена, безопасность и правовые ограничения"
];

export function AdminDeliveryControlPanel({ context }: AdminDeliveryControlPanelProps) {
  const copy = contextCopy[context];

  return (
    <section className="grid gap-4">
      <Card className="border-primary/20 bg-primary/10">
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            <Badge variant="info">Демонстрационный режим: изменения не сохраняются</Badge>
            <Badge variant="warning">Нужна ручная проверка</Badge>
            <Badge variant="danger">Высокий риск</Badge>
            <Badge variant="muted">ALCOHOL_MODULE_ENABLED=false</Badge>
          </div>
          <CardTitle className="text-xl">{copy.title}</CardTitle>
          <CardDescription>{copy.description}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-3">
          <RuleColumn title="Этапы доставки" items={deliveryStages} tone="info" />
          <RuleColumn title="Требуют внимания" items={attentionBlocks} tone="warning" />
          <RuleColumn title="Уровни риска" items={riskLevels} tone="danger" />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Что админ может сделать</CardTitle>
            <CardDescription>
              Администратор проверяет состояние доставки и готовит решения. Этот экран не выполняет реальных изменений.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {adminCan.map((item) => (
              <div className="rounded-lg border border-border bg-background p-3 text-sm font-semibold text-foreground" key={item}>
                {item}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-danger/30 bg-danger/10">
          <CardHeader>
            <CardTitle>Опасные действия требуют подтверждения</CardTitle>
            <CardDescription>
              Перед выполнением этих действий необходимы подтверждение администратора, основание, оценка риска и запись в журнал.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {highRiskActions.map((item) => (
              <div className="rounded-lg border border-danger/20 bg-surface p-3 text-sm font-semibold" key={item}>
                {item}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Безопасность ИИ-диспетчера</CardTitle>
            <CardDescription>ИИ помогает администратору, но не выполняет опасные рабочие или финансовые операции.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {[...aiCan.map((item) => ({ item, blocked: false })), ...aiCannot.map((item) => ({ item, blocked: true }))].map(({ item, blocked }) => (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3" key={item}>
                <span className="text-sm font-semibold text-foreground">{item}</span>
                <Badge variant={blocked ? "danger" : "info"}>
                  {blocked ? "Запрещено" : "Демонстрация"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-warning/30 bg-warning/10">
          <CardHeader>
            <CardTitle>Ограничения продажи алкоголя</CardTitle>
            <CardDescription>
              Any Запрос на продажу алкоголя is critical risk and admin/legal review only.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Badge className="w-fit" variant="danger">Продажа и доставка алкоголя отключены</Badge>
            <p className="text-sm leading-6 text-muted">
              `ALCOHOL_MODULE_ENABLED=false`. ИИ не может включить продажу алкоголя. Any future activation requires legal
              проверка, лицензирование, проверка партнёра и подтверждение главного администратора.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline">Просмотреть рекомендацию ИИ</Button>
              <Button variant="secondary">Подготовить переназначение</Button>
              <Button disabled variant="outline">Изменение оплаты отключено</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function RuleColumn({ items, title, tone }: { items: string[]; title: string; tone: "info" | "warning" | "danger" }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <Badge variant={tone}>{title}</Badge>
      <div className="mt-4 grid gap-2">
        {items.map((item) => (
          <div className="rounded-lg border border-border bg-background p-3 text-sm font-semibold text-foreground" key={item}>
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
