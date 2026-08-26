import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

type CourierIssueEscalationPanelProps = {
  context: "overview" | "deliveries" | "delivery-detail" | "active" | "issues" | "dispatcher" | "profile";
};

const contextCopy: Record<CourierIssueEscalationPanelProps["context"], string> = {
  overview: "Escalation доступна только после подключения server-side issue backend.",
  deliveries: "Issue относится только к доставке внутри текущего courier scope.",
  "delivery-detail": "Нельзя раскрывать или изменять доставку вне courier assignment.",
  active: "Проблема активной доставки должна сохраняться отдельной audited server-side операцией.",
  issues: "Форма issue не активируется до появления assignment validation и audit log.",
  dispatcher: "AI может только рекомендовать эскалацию на подтверждённых данных.",
  profile: "Проблемы профиля требуют authenticated courier profile и admin support flow."
};

const categories = [
  "Партнёр / выдача",
  "Клиент / адрес / доступность",
  "Комплектация / повреждение",
  "Маршрут / транспорт / безопасность",
  "Оплата / отмена / refund — только admin/finance"
];

const restrictions = [
  "Issue не меняет order status автоматически.",
  "Issue не меняет payment status.",
  "Issue не инициирует refund/payout.",
  "Critical case требует human admin.",
  "ALCOHOL_MODULE_ENABLED остаётся false."
];

export function CourierIssueEscalationPanel({ context }: CourierIssueEscalationPanelProps) {
  return (
    <Card className="border-warning/35 bg-warning/10 shadow-card">
      <CardHeader className="space-y-3 pb-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant="warning">issue backend required</Badge>
          <Badge variant="danger">human admin for critical</Badge>
          <Badge variant="muted">write disabled</Badge>
        </div>
        <div>
          <CardTitle className="text-base">Courier issue escalation contract</CardTitle>
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
        <Badge variant={tone}>{tone}</Badge>
      </div>
      <ul className="space-y-1 text-sm leading-5 text-muted">
        {items.map((item) => <li className="break-words" key={item}>{item}</li>)}
      </ul>
    </div>
  );
}
