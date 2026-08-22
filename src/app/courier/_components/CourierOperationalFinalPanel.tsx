import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

type CourierOperationalContext =
  | "overview"
  | "deliveries"
  | "delivery-detail"
  | "active"
  | "history"
  | "earnings"
  | "issues"
  | "profile"
  | "dispatcher";

type CourierOperationalFinalPanelProps = {
  context: CourierOperationalContext;
};

const contextCopy: Record<CourierOperationalContext, { title: string; focus: string }> = {
  overview: { title: "Courier operational contract", focus: "Dashboard показывает только courier-scoped read и не выполняет неподтверждённые writes." },
  deliveries: { title: "Courier delivery contract", focus: "Список доставок ограничивается назначениями текущего courier user." },
  "delivery-detail": { title: "Delivery detail contract", focus: "Детали доступны только для доставки внутри текущего courier scope." },
  active: { title: "Active delivery contract", focus: "Активная доставка не подменяется общим orders-каталогом или mock-контактами." },
  history: { title: "History contract", focus: "История требует отдельного scoped history reader и фактических timestamps." },
  earnings: { title: "Finance contract", focus: "Доход и выплаты требуют отдельного finance ledger и не рассчитываются в UI." },
  issues: { title: "Issue contract", focus: "Issue write требует assignment check, server-side write и audit log." },
  profile: { title: "Profile contract", focus: "Профиль доступен только из authenticated courier profile и RLS." },
  dispatcher: { title: "AI dispatcher contract", focus: "AI использует только подтверждённые события и не выполняет high-risk writes." }
};

const allowed = [
  "Читать только данные текущего courier scope.",
  "Показывать фактический delivery/order status из разрешённого reader.",
  "Передавать проблему в отдельный admin/escalation backend после его подключения.",
  "Использовать AI только как recommendation layer на подтверждённых событиях."
];

const blocked = [
  "Нельзя менять payment status из courier UI.",
  "Нельзя отменять заказ или подтверждать refund/payout.",
  "Нельзя показывать придуманные адреса, телефоны, ETA, доход или историю.",
  "Нельзя выполнять delivery transition без server-side assignment/state validation.",
  "ALCOHOL_MODULE_ENABLED остаётся false."
];

export function CourierOperationalFinalPanel({ context }: CourierOperationalFinalPanelProps) {
  const copy = contextCopy[context];

  return (
    <section className="grid gap-4">
      <Card className="border-primary/20 bg-primary/10">
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            <Badge variant="info">scoped reads</Badge>
            <Badge variant="warning">writes fail-closed</Badge>
            <Badge variant="danger">high-risk admin only</Badge>
            <Badge variant="muted">ALCOHOL_MODULE_ENABLED=false</Badge>
          </div>
          <CardTitle className="text-xl">{copy.title}</CardTitle>
          <CardDescription>{copy.focus}</CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <RuleCard title="Разрешённый контур" items={allowed} tone="success" />
        <RuleCard title="Заблокированный контур" items={blocked} tone="danger" />
      </div>
    </section>
  );
}

function RuleCard({ items, title, tone }: { items: string[]; title: string; tone: "success" | "danger" }) {
  return (
    <Card className={tone === "danger" ? "border-danger/30 bg-danger/10" : undefined}>
      <CardHeader>
        <Badge className="w-fit" variant={tone}>{tone}</Badge>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        {items.map((item) => (
          <div className="rounded-md border border-border bg-background p-3 text-sm font-medium text-foreground" key={item}>{item}</div>
        ))}
      </CardContent>
    </Card>
  );
}
