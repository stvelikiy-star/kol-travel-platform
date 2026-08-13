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
      "Admin view for stuck orders, partner readiness, courier assignment, delivery issues and manual review."
  },
  "ai-dispatcher": {
    title: "AI-диспетчер рекомендует",
    description:
      "AI dispatcher can detect delays, classify severity, recommend reassignment and alert admin, but cannot approve high-risk actions."
  }
};

const deliveryStages = [
  "New order",
  "Accepted by partner",
  "Preparing",
  "Ready for pickup",
  "Courier assigned",
  "Courier going to partner",
  "Picked up",
  "Courier going to client",
  "Delivered",
  "Issue reported",
  "Admin required"
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
  "view stuck orders",
  "view partner readiness",
  "view courier assignment state",
  "view delivery issue severity",
  "review AI recommendation",
  "decide whether manual action is needed",
  "prepare future courier reassignment",
  "prepare future issue resolution"
];

const highRiskActions = [
  "cancel accepted order",
  "cancel after pickup",
  "change payment status",
  "approve refund",
  "force complete order",
  "force close delivery issue",
  "reassign courier after pickup",
  "block partner",
  "block courier",
  "alcohol-related request"
];

const aiCannot = [
  "AI cannot cancel order",
  "AI cannot change payment status",
  "AI cannot approve refund",
  "AI cannot enable alcohol module",
  "Critical actions require human admin approval"
];

const aiCan = [
  "AI can detect delays",
  "AI can classify issue severity",
  "AI can recommend reassignment",
  "AI can draft messages",
  "AI can alert admin"
];

const riskLevels = [
  "low: information only",
  "medium: delay or clarification",
  "high: order/delivery blocked",
  "critical: payment, refund, cancellation, safety, legal, alcohol compliance"
];

export function AdminDeliveryControlPanel({ context }: AdminDeliveryControlPanelProps) {
  const copy = contextCopy[context];

  return (
    <section className="grid gap-4">
      <Card className="border-primary/20 bg-primary/10">
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            <Badge variant="info">Demo режим: изменения пока не сохраняются</Badge>
            <Badge variant="warning">Нужна ручная проверка</Badge>
            <Badge variant="danger">Высокий риск</Badge>
            <Badge variant="muted">ALCOHOL_MODULE_ENABLED=false</Badge>
          </div>
          <CardTitle className="text-xl">{copy.title}</CardTitle>
          <CardDescription>{copy.description}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-3">
          <RuleColumn title="Delivery operation stages" items={deliveryStages} tone="info" />
          <RuleColumn title="Attention blocks" items={attentionBlocks} tone="warning" />
          <RuleColumn title="Risk levels" items={riskLevels} tone="danger" />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Что админ может сделать</CardTitle>
            <CardDescription>
              Admin reviews delivery state and prepares future manual actions. No real backend mutation is connected.
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
            <CardTitle>High-risk actions require audit later</CardTitle>
            <CardDescription>
              These actions require human approval, reason, risk level and audit log before real execution.
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
            <CardTitle>AI dispatcher safety</CardTitle>
            <CardDescription>AI assists the admin, but does not execute high-risk operational or finance actions.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {[...aiCan, ...aiCannot].map((item) => (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3" key={item}>
                <span className="text-sm font-semibold text-foreground">{item}</span>
                <Badge variant={item.includes("cannot") || item.includes("Critical") ? "danger" : "info"}>
                  {item.includes("cannot") || item.includes("Critical") ? "blocked" : "demo"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-warning/30 bg-warning/10">
          <CardHeader>
            <CardTitle>Alcohol compliance</CardTitle>
            <CardDescription>
              Any alcohol-related request is critical risk and admin/legal review only.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Badge className="w-fit" variant="danger">Alcohol sales/delivery disabled</Badge>
            <p className="text-sm leading-6 text-muted">
              `ALCOHOL_MODULE_ENABLED=false`. AI cannot enable alcohol module. Any future activation requires legal
              review, licensing, partner verification and super_admin approval.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline">Review AI recommendation demo</Button>
              <Button variant="secondary">Prepare reassignment demo</Button>
              <Button disabled variant="outline">Change payment disabled</Button>
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
