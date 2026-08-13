import { PartnerLayout } from "@/components/layout/PartnerLayout";
import { PartnerIssueEscalationPanel } from "@/app/partner/_components/PartnerIssueEscalationPanel";
import { PartnerStopDemoActions } from "@/app/partner/stop/PartnerStopDemoActions";
import { PartnerStopButtonRulesPanel } from "@/app/partner/stop/_components/PartnerStopButtonRulesPanel";
import { PartnerStopScopeCard } from "@/components/partner/PartnerStopScopeCard";
import { PartnerWarningCard } from "@/components/partner/PartnerWarningCard";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

type StopStatus = "active" | "paused" | "stopped" | "limited";

const statusVariant: Record<StopStatus, BadgeVariant> = {
  active: "success",
  paused: "warning",
  stopped: "danger",
  limited: "info"
};

const stopCards: Array<{ title: string; description: string; status: StopStatus }> = [
  { title: "Business status", description: "Останавливает новые заявки всего бизнеса.", status: "active" },
  { title: "Delivery status", description: "Останавливает только новые доставки.", status: "limited" },
  { title: "New orders status", description: "Блокирует новые заказы еды и магазина.", status: "active" },
  { title: "Bookings status", description: "Блокирует новые брони жилья и туров.", status: "active" },
  { title: "Specific item stop demo", description: "Останавливает выбранное блюдо или позицию меню.", status: "paused" },
  { title: "Product stop demo", description: "Останавливает выбранный товар магазина.", status: "active" },
  { title: "Room stop demo", description: "Останавливает выбранный номер или дату.", status: "limited" },
  { title: "Tour stop demo", description: "Останавливает выбранный тур или дату тура.", status: "active" }
];

const affects = [
  "new orders",
  "new bookings",
  "selected product/item/room/tour",
  "delivery availability"
];

const neverDoes = [
  "does not cancel accepted orders",
  "does not cancel accepted bookings",
  "does not change payment status",
  "does not delete catalog items"
];

export default function PartnerStopPage() {
  return (
    <PartnerLayout>
      <PartnerIssueEscalationPanel context="stop" />
      <PartnerStopButtonRulesPanel />

      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-secondary via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">Stop control</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Стоп-кнопка</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
            Demo control panel для управления доступностью бизнеса, доставки, заказов, броней и отдельных позиций.
          </p>
        </div>
      </Card>

      <PartnerWarningCard
        description="Стоп-кнопка не отменяет уже принятые заказы и брони. Она блокирует только новые заявки или выбранный scope."
        title="Главное правило stop"
        tone="warning"
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stopCards.map((item) => (
          <Card key={item.title}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>{item.title}</CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </div>
                <Badge variant={statusVariant[item.status]}>{item.status}</Badge>
              </div>
            </CardHeader>
          </Card>
        ))}
      </section>

      <PartnerStopScopeCard
        affectedArea="Demo partner business scope"
        description="UI-only controls. Реальные PartnerStopStatus records будут подключены позже."
        safetyNote="Stop actions block only new orders/bookings or selected scope. Accepted work continues."
        scopeType="business"
        status="active"
        title="PartnerStopStatus demo"
      />

      <PartnerStopDemoActions />

      <section className="grid gap-4 lg:grid-cols-2">
        <RuleList title="What stop button affects" items={affects} variant="warning" />
        <RuleList title="What stop button never does" items={neverDoes} variant="info" />
      </section>
    </PartnerLayout>
  );
}

function RuleList({ items, title, variant }: { items: string[]; title: string; variant: BadgeVariant }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {items.map((item) => (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-4" key={item}>
            <span className="text-sm font-semibold text-foreground">{item}</span>
            <Badge variant={variant}>rule</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
