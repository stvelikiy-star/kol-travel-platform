import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

type CourierIssueEscalationPanelProps = {
  context: "overview" | "deliveries" | "delivery-detail" | "active" | "issues" | "dispatcher" | "profile";
};

const contextCopy: Record<CourierIssueEscalationPanelProps["context"], string> = {
  overview: "Передача проблемы администратору станет доступна после подключения защищённой серверной обработки обращений.",
  deliveries: "Обращение может относиться только к доставке, назначенной текущему курьеру.",
  "delivery-detail": "Нельзя раскрывать или изменять доставку, не назначенную текущему курьеру.",
  active: "Проблема активной доставки должна сохраняться защищённой серверной операцией с записью в журнал.",
  issues: "Форма обращения недоступна до подключения проверки назначения курьера и журнала действий.",
  dispatcher: "ИИ может только рекомендовать передачу проблемы администратору на основе подтверждённых данных.",
  profile: "Проблемы с профилем обрабатываются только после подтверждения учётной записи курьера и обращения в поддержку."
};

const categories = [
  "Партнёр / выдача",
  "Клиент / адрес / доступность",
  "Комплектация / повреждение",
  "Маршрут / транспорт / безопасность",
  "Оплата, отмены и возвраты — только через администратора и финансовый раздел"
];

const restrictions = [
  "Обращение не меняет статус заказа автоматически.",
  "Обращение не меняет статус оплаты.",
  "Обращение не запускает возврат средств или выплату.",
  "Критический случай требует решения администратора.",
  "Продажа алкоголя остаётся отключённой."
];

export function CourierIssueEscalationPanel({ context }: CourierIssueEscalationPanelProps) {
  return (
    <Card className="border-warning/35 bg-warning/10 shadow-card">
      <CardHeader className="space-y-3 pb-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant="warning">Требуется сервис обращений</Badge>
          <Badge variant="danger">Критические решения — человеку</Badge>
          <Badge variant="muted">Изменения отключены</Badge>
        </div>
        <div>
          <CardTitle className="text-base">Правила передачи проблем доставки</CardTitle>
          <CardDescription>{contextCopy[context]}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-2">
        <RuleList title="Категории" items={categories} tone="warning" />
        <RuleList title="Ограничения" items={restrictions} tone="danger" />
      </CardContent>
    </Card>
  );
}

function RuleList({ items, title, tone }: { items: string[]; title: string; tone: "danger" | "warning" }) {
  return (
    <div className="rounded-md border border-border bg-background/90 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <Badge variant={tone}>{tone === "danger" ? "Важно" : "Предупреждение"}</Badge>
      </div>
      <ul className="space-y-1 text-sm leading-5 text-muted">
        {items.map((item) => <li className="wrap-break-word" key={item}>{item}</li>)}
      </ul>
    </div>
  );
}
