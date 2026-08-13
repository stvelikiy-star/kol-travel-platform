import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

type CatalogStopContext = "overview" | "tour" | "stay" | "food" | "product";

type PartnerCatalogStopRulesPanelProps = {
  context: CatalogStopContext;
};

const contextCopy: Record<CatalogStopContext, { title: string; focus: string; controls: string[] }> = {
  overview: {
    title: "Catalog stop and status control",
    focus: "Shared demo rules for tours, stays, menu items and products.",
    controls: [
      "Управление позицией",
      "Статус позиции",
      "В продаже / Доступно",
      "Временно остановлено",
      "Нет в наличии"
    ]
  },
  tour: {
    title: "Tour catalog stop UX",
    focus: "Tour active / paused, stop tour date, stop time slot and seats unavailable.",
    controls: [
      "tour active",
      "tour paused",
      "stop tour date",
      "stop tour time slot",
      "seats unavailable"
    ]
  },
  stay: {
    title: "Stay and room catalog stop UX",
    focus: "Room active / paused, stop room type, blocked dates and booking conflicts.",
    controls: [
      "room active",
      "room paused",
      "stop room type",
      "block dates",
      "booking conflict"
    ]
  },
  food: {
    title: "Food catalog stop UX",
    focus: "Dish active / paused, out of stock, kitchen overload and prep time notice later.",
    controls: [
      "dish active",
      "dish paused",
      "out of stock",
      "kitchen overloaded",
      "prep time notice later"
    ]
  },
  product: {
    title: "Product catalog stop UX",
    focus: "Product active / paused, out of stock, low stock and category stop.",
    controls: [
      "product active",
      "product paused",
      "out of stock",
      "low stock",
      "stop product category"
    ]
  }
};

const stopActions = [
  "Остановить позицию",
  "Остановить категорию",
  "Причина остановки",
  "Когда возобновить",
  "Demo режим: изменения пока не сохраняются"
];

const partnerRules = [
  "Partner can pause future sales",
  "Partner can stop one item",
  "Partner can stop one category",
  "Partner can add reason",
  "Partner can show planned resume time",
  "Partner cannot cancel accepted orders without admin",
  "Partner cannot cancel confirmed bookings without admin",
  "Partner cannot change payment status",
  "Partner cannot force refund",
  "Partner cannot enable alcohol module"
];

const aiRules = [
  "AI can recommend pausing a position",
  "AI can detect overload or stock issue",
  "AI can alert admin",
  "AI can draft customer/partner message",
  "AI cannot cancel accepted orders/bookings",
  "AI cannot change payment",
  "AI cannot enable alcohol module"
];

const acceptedWorkNotes = [
  "Accepted food/product orders continue",
  "Confirmed tour/stay bookings remain active",
  "Delivery in progress is not cancelled",
  "Payment status is not changed",
  "Refunds require admin approval"
];

export function PartnerCatalogStopRulesPanel({ context }: PartnerCatalogStopRulesPanelProps) {
  const copy = contextCopy[context];

  return (
    <section className="grid gap-4">
      <Card className="border-primary/20 bg-primary/10">
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            <Badge variant="info">Управление позицией</Badge>
            <Badge variant="success">В продаже / Доступно</Badge>
            <Badge variant="warning">Временно остановлено</Badge>
            <Badge variant="danger">Нужен админ</Badge>
            <Badge variant="muted">ALCOHOL_MODULE_ENABLED=false</Badge>
          </div>
          <CardTitle className="text-xl">{copy.title}</CardTitle>
          <CardDescription>{copy.focus}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          <RuleColumn title="Статус позиции" items={copy.controls} tone="info" />
          <RuleColumn title="Stop controls" items={stopActions} tone="warning" />
          <RuleColumn title="Rules" items={partnerRules} tone="success" />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Что будет с уже принятыми заказами</CardTitle>
            <CardDescription>
              Catalog stop affects only future sales/bookings. Accepted work is protected and needs admin escalation
              for cancellation.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {acceptedWorkNotes.map((item) => (
              <div className="rounded-lg border border-border bg-background p-3 text-sm font-semibold text-foreground" key={item}>
                {item}
              </div>
            ))}
          </CardContent>
          <CardContent className="flex flex-wrap gap-3 pt-0">
            <Button variant="danger">Остановить позицию demo</Button>
            <Button variant="outline">Остановить категорию demo</Button>
            <Button variant="secondary">Resume at planned time demo</Button>
          </CardContent>
        </Card>

        <Card className="border-danger/30 bg-danger/10">
          <CardHeader>
            <CardTitle>Нужен админ</CardTitle>
            <CardDescription>
              Cancellation, payment, refund, legal/compliance and alcohol-related requests are high-risk.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {[
              "accepted order cancellation",
              "confirmed booking cancellation",
              "payment status change",
              "refund request",
              "legal/compliance issue",
              "alcohol-related request"
            ].map((item) => (
              <div className="rounded-lg border border-danger/20 bg-surface p-3 text-sm font-semibold" key={item}>
                {item}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>AI safety</CardTitle>
            <CardDescription>
              AI can recommend pausing and draft messages, but cannot execute high-risk catalog actions.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {aiRules.map((item) => (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3" key={item}>
                <span className="text-sm font-semibold text-foreground">{item}</span>
                <Badge variant={item.includes("cannot") ? "danger" : "info"}>{item.includes("cannot") ? "blocked" : "allowed"}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-warning/30 bg-warning/10">
          <CardHeader>
            <CardTitle>Alcohol compliance</CardTitle>
            <CardDescription>
              Alcohol module remains OFF. Catalog stop/status UX cannot create alcohol sales or delivery flows.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Badge className="w-fit" variant="danger">
              Alcohol sales/delivery disabled
            </Badge>
            <p className="text-sm leading-6 text-muted">
              AI cannot enable alcohol module. Any future alcohol activation requires legal review, licensing, partner
              verification and super_admin approval.
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function RuleColumn({ items, title, tone }: { items: string[]; title: string; tone: "success" | "info" | "warning" }) {
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
