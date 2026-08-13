import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
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
  overview: {
    title: "Courier operational workflow",
    focus: "Dashboard summary for available deliveries, active route, next step and admin/AI exceptions."
  },
  deliveries: {
    title: "Доступные доставки",
    focus: "Courier reviews available deliveries, accepts demo delivery and opens route or issue flow."
  },
  "delivery-detail": {
    title: "Delivery detail operations",
    focus: "Route, partner point, client point, physical progress and issue escalation for one delivery."
  },
  active: {
    title: "Активная доставка",
    focus: "Current delivery route with next step, pickup, client handoff and delivered state."
  },
  history: {
    title: "History and completed deliveries",
    focus: "Completed deliveries are demo records. Payment and payout calculations are future backend logic."
  },
  earnings: {
    title: "Earnings demo mode",
    focus: "Courier can view earnings, but cannot manually change payout or payment status."
  },
  issues: {
    title: "Проблема на доставке",
    focus: "Courier reports route, partner, client, vehicle, safety or payment issues for admin/AI review."
  },
  profile: {
    title: "Courier responsibility settings",
    focus: "Profile, status and shift settings are demo-only. Real verification and GPS come later."
  },
  dispatcher: {
    title: "AI-диспетчер",
    focus: "AI can recommend, detect delay, classify severity and alert admin, but cannot execute high-risk actions."
  }
};

const workflow = [
  "Available delivery",
  "Accept delivery",
  "Go to partner",
  "Arrive at partner",
  "Pick up order",
  "Go to client",
  "Arrive at client",
  "Mark delivered",
  "Report issue if needed",
  "Admin/AI dispatcher handles exceptions"
];

const visibleBlocks = [
  "Доступные доставки",
  "Активная доставка",
  "Следующий шаг",
  "Маршрут",
  "Точка партнёра",
  "Точка клиента",
  "Ожидает забора",
  "Забрал заказ",
  "В пути к клиенту",
  "Доставлено"
];

const courierCan = [
  "accept available delivery",
  "update physical delivery progress",
  "report issue",
  "contact admin",
  "follow AI dispatcher recommendation",
  "view route/next step",
  "view earnings/history"
];

const courierCannot = [
  "change payment status",
  "change order items",
  "cancel order without admin",
  "approve refund",
  "edit partner preparation status",
  "enable alcohol module"
];

const issueNextActions = [
  "partner not ready → wait briefly, report issue, contact admin",
  "wrong order given → do not pick up, report partner issue",
  "client not answering → call demo contact, wait, escalate",
  "wrong address → request admin/client clarification",
  "traffic delay → update route issue and continue safely",
  "vehicle problem → report high severity and request reassignment",
  "order damaged → stop handoff and escalate admin",
  "client refused order → report issue, do not refund manually",
  "emergency incident → critical risk, human admin required"
];

const aiRules = [
  "AI can recommend next step",
  "AI can detect delay",
  "AI can classify issue severity",
  "AI can alert admin",
  "AI can draft message",
  "AI cannot cancel order",
  "AI cannot change payment",
  "AI cannot approve refund",
  "AI cannot enable alcohol module",
  "Critical issues require human admin"
];

export function CourierOperationalFinalPanel({ context }: CourierOperationalFinalPanelProps) {
  const copy = contextCopy[context];

  return (
    <section className="grid gap-4">
      <Card className="border-primary/20 bg-primary/10">
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            <Badge variant="info">Demo режим: изменения пока не сохраняются</Badge>
            <Badge variant="success">Следующий шаг</Badge>
            <Badge variant="warning">Проблема на доставке</Badge>
            <Badge variant="danger">Связаться с админом</Badge>
            <Badge variant="muted">ALCOHOL_MODULE_ENABLED=false</Badge>
          </div>
          <CardTitle className="text-xl">{copy.title}</CardTitle>
          <CardDescription>{copy.focus}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-3">
          <RuleColumn title="Courier workflow" items={workflow} tone="info" />
          <RuleColumn title="Visible route blocks" items={visibleBlocks} tone="success" />
          <RuleColumn title="Issue next actions" items={issueNextActions} tone="warning" />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Что курьер может делать</CardTitle>
            <CardDescription>
              Courier controls physical delivery progress only: pickup, route, client handoff and delivered state.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {courierCan.map((item) => (
              <div className="rounded-lg border border-border bg-background p-3 text-sm font-semibold text-foreground" key={item}>
                {item}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-danger/30 bg-danger/10">
          <CardHeader>
            <CardTitle>Что курьер не может делать</CardTitle>
            <CardDescription>
              High-risk order, payment, refund and compliance actions require admin approval.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {courierCannot.map((item) => (
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
            <CardTitle>AI-диспетчер</CardTitle>
            <CardDescription>
              AI helps with recommendations and alerts. Critical issues require human admin approval.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {aiRules.map((item) => (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3" key={item}>
                <span className="text-sm font-semibold text-foreground">{item}</span>
                <Badge variant={item.includes("cannot") ? "danger" : item.includes("Critical") ? "warning" : "info"}>
                  {item.includes("cannot") ? "blocked" : item.includes("Critical") ? "admin" : "demo"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-warning/30 bg-warning/10">
          <CardHeader>
            <CardTitle>Earnings and compliance</CardTitle>
            <CardDescription>
              Earnings/history are demo-only. Payment and payout calculations are future backend logic.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Badge className="w-fit" variant="warning">
              Courier cannot manually change payout/payment status
            </Badge>
            <Badge className="w-fit" variant="danger">
              Alcohol delivery disabled
            </Badge>
            <p className="text-sm leading-6 text-muted">
              AI cannot enable alcohol module. Any future alcohol activation requires legal review, licensing, partner
              verification and super_admin approval.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline">Связаться с админом demo</Button>
              <Button variant="secondary">AI recommends next step demo</Button>
              <Button disabled variant="outline">Cancel order disabled</Button>
            </div>
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
