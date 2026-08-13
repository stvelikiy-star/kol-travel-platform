import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

type PartnerIssueEscalationPanelProps = {
  context:
    | "overview"
    | "orders"
    | "order-detail"
    | "bookings"
    | "booking-detail"
    | "delivery"
    | "stop"
    | "settings";
};

const issueCases = [
  "courier is late",
  "order ready but not picked up",
  "item unavailable",
  "kitchen/partner overloaded",
  "client changed request",
  "client cancelled verbally",
  "wrong order details",
  "payment issue",
  "booking conflict",
  "guest did not arrive",
  "emergency stop required"
];

const aiRules = [
  "AI can recommend",
  "AI can alert admin",
  "AI can draft message",
  "AI cannot cancel order",
  "AI cannot approve refund",
  "AI cannot change payment",
  "AI cannot enable alcohol module"
];

const contextCopy: Record<PartnerIssueEscalationPanelProps["context"], string> = {
  overview: "Dashboard-level escalation panel for partner work that needs attention.",
  orders: "Use when an order is blocked, late, changed verbally, or ready but not picked up.",
  "order-detail": "Use before requesting cancellation, refund review, or courier/admin help.",
  bookings: "Use when a booking conflict, no-show, guest issue, or date change appears.",
  "booking-detail": "Use before changing or cancelling a confirmed booking.",
  delivery: "Use when ready_for_pickup waits too long or courier handoff has a problem.",
  stop: "Use for urgent future-order pauses. Stop does not cancel accepted orders/bookings.",
  settings: "Use to document why operational settings need admin review."
};

export function PartnerIssueEscalationPanel({ context }: PartnerIssueEscalationPanelProps) {
  return (
    <Card className="border-warning/35 bg-warning/10 shadow-card">
      <CardHeader className="space-y-3 pb-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant="warning">Заявка на эскалацию</Badge>
          <Badge variant="info">AI-диспетчер рекомендует</Badge>
          <Badge variant="danger">Срочный случай</Badge>
          <Badge variant="muted">ALCOHOL_MODULE_ENABLED=false</Badge>
        </div>
        <div>
          <CardTitle className="text-base">Сообщить проблему партнёра</CardTitle>
          <CardDescription>{contextCopy[context]}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 xl:grid-cols-3">
          <RuleList title="Причина обращения" items={issueCases} tone="warning" />
          <RuleList
            title="Когда подключается админ"
            items={["payment issue", "accepted order cancellation", "confirmed booking cancellation", "courier no-show", "emergency stop required"]}
            tone="danger"
          />
          <RuleList title="AI rules" items={aiRules} tone="info" />
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <RuleList
            title="Что партнёр может делать"
            items={["Partner can report issue", "Partner can request admin help", "Partner can pause future orders", "Partner can keep accepted work visible"]}
            tone="success"
          />
          <RuleList
            title="Что нельзя делать без админа"
            items={["Partner cannot cancel accepted order without admin", "Partner cannot change payment status", "Partner cannot force refund", "Partner cannot enable alcohol module"]}
            tone="danger"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="danger">Сообщить проблему demo</Button>
          <Button variant="outline">Связаться с админом demo</Button>
          <Button variant="secondary">Стоп новых заказов demo</Button>
          <Button disabled variant="outline">Force refund disabled</Button>
          <Button disabled variant="outline">Change payment disabled</Button>
        </div>

        <div className="rounded-md border border-warning/40 bg-surface p-3 text-sm leading-6 text-foreground">
          Alcohol sales/delivery disabled. AI cannot enable alcohol module. Any future alcohol activation requires legal review,
          licensing, partner verification and super_admin approval.
        </div>
      </CardContent>
    </Card>
  );
}

function RuleList({ items, title, tone }: { items: string[]; title: string; tone: "success" | "danger" | "warning" | "info" }) {
  return (
    <div className="rounded-md border border-border bg-background/90 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <Badge variant={tone}>{tone}</Badge>
      </div>
      <ul className="space-y-1 text-sm leading-5 text-muted">
        {items.map((item) => (
          <li className="break-words" key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
