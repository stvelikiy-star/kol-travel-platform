import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

type CourierIssueEscalationPanelProps = {
  context: "overview" | "deliveries" | "delivery-detail" | "active" | "issues" | "dispatcher" | "profile";
};

const issueCases = [
  "partner is not ready",
  "partner gave wrong order",
  "courier cannot find partner location",
  "courier cannot contact client",
  "client refuses order",
  "client address problem",
  "traffic delay",
  "vehicle problem",
  "accident/emergency",
  "payment issue",
  "order damaged",
  "delivery route blocked",
  "courier needs admin support"
];

const severity = [
  "low: information only",
  "medium: delay or clarification",
  "high: delivery blocked",
  "critical: safety, payment, cancellation, refund, legal/compliance risk"
];

const aiRules = [
  "AI can classify issue severity",
  "AI can recommend next action",
  "AI can alert admin",
  "AI can draft message",
  "AI cannot cancel order",
  "AI cannot approve refund",
  "AI cannot change payment",
  "AI cannot enable alcohol module",
  "Critical issues require human admin"
];

const contextCopy: Record<CourierIssueEscalationPanelProps["context"], string> = {
  overview: "Use this panel when courier dashboard shows a delivery that needs attention.",
  deliveries: "Use this panel before accepting, opening, or escalating a delivery problem.",
  "delivery-detail": "Use this panel when pickup, route, client contact, payment or safety issues appear.",
  active: "Use this panel during active delivery when the next physical step is blocked.",
  issues: "Use this panel to classify and describe courier issue reports.",
  dispatcher: "Use this panel to understand what AI can recommend and what requires human admin.",
  profile: "Use this panel when courier status, shift, vehicle or safety settings need admin support."
};

export function CourierIssueEscalationPanel({ context }: CourierIssueEscalationPanelProps) {
  return (
    <Card className="border-warning/35 bg-warning/10 shadow-card">
      <CardHeader className="space-y-3 pb-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant="warning">Сообщить проблему</Badge>
          <Badge variant="info">AI-диспетчер</Badge>
          <Badge variant="danger">Срочный случай</Badge>
          <Badge variant="muted">ALCOHOL_MODULE_ENABLED=false</Badge>
        </div>
        <div>
          <CardTitle className="text-base">Courier issue escalation</CardTitle>
          <CardDescription>{contextCopy[context]}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 xl:grid-cols-3">
          <RuleList title="Тип проблемы" items={issueCases} tone="warning" />
          <RuleList title="Issue severity" items={severity} tone="danger" />
          <RuleList title="AI rules" items={aiRules} tone="info" />
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <RuleList
            title="Что может делать курьер"
            items={["Courier can report issue", "Courier can request admin help", "Courier can update physical delivery progress"]}
            tone="success"
          />
          <RuleList
            title="Что нельзя делать курьеру"
            items={["Courier cannot change payment status", "Courier cannot change order items", "Courier cannot cancel order without admin", "Courier cannot enable alcohol module"]}
            tone="danger"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="danger">Сообщить проблему demo</Button>
          <Button variant="outline">Связаться с админом demo</Button>
          <Button variant="secondary">Следующий шаг demo</Button>
          <Button disabled variant="outline">Cancel order disabled</Button>
          <Button disabled variant="outline">Change payment disabled</Button>
        </div>

        <div className="rounded-md border border-warning/40 bg-surface p-3 text-sm leading-6 text-foreground">
          Alcohol delivery disabled. AI cannot enable alcohol module. Any future alcohol activation requires legal review,
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
