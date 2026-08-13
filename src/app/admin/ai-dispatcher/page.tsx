import { AdminLayout } from "@/components/layout/AdminLayout";
import { AdminAiDispatcherDemoActions } from "@/app/admin/ai-dispatcher/AdminAiDispatcherDemoActions";
import { AdminDeliveryControlPanel } from "@/app/admin/delivery/_components/AdminDeliveryControlPanel";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { getAIRecommendationsDemo, getAdminOrders } from "@/lib/data/admin";

type RiskLevel = "low" | "medium" | "high" | "critical";

const monitoringCards = [
  "Stuck orders",
  "Partner delays",
  "No courier assigned",
  "Courier not accepted",
  "Courier delay",
  "Client not reachable",
  "Admin required"
];

const decisionFields = [
  "situation_summary",
  "risk_level: low / medium / high / critical",
  "recommended_action",
  "who_to_notify",
  "message_to_admin",
  "message_to_partner",
  "message_to_courier",
  "message_to_client",
  "human_approval_required"
];

const timeRules = [
  "partner no accept 5 min -> alert admin",
  "ready_for_pickup no courier 7 min -> urgent courier search",
  "courier assigned no accept 3 min -> reassign suggestion",
  "courier picked up delayed -> alert admin",
  "client not reachable -> admin escalation"
];

const safetyRules = [
  "AI never invents facts.",
  "AI never cancels orders without admin approval.",
  "AI never changes payment status.",
  "AI never promises delivery time without data.",
  "AI never enables alcohol delivery."
];

const riskVariant: Record<RiskLevel, BadgeVariant> = {
  low: "success",
  medium: "warning",
  high: "danger",
  critical: "danger"
};

export default function AdminAiDispatcherPage() {
  const orders = getAdminOrders();
  const recommendations = getAIRecommendationsDemo();

  return (
    <AdminLayout status="attention">
      <AdminDeliveryControlPanel context="ai-dispatcher" />

      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-lake-dark via-primary to-sand p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">AI dispatcher</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">AI-диспетчер</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
            AI dispatcher works in demo mode. Real notifications, assignments and escalation will be connected later.
          </p>
        </div>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {monitoringCards.map((item, index) => (
          <Card key={item}>
            <CardContent className="space-y-3 p-5">
              <Badge variant={index > 4 ? "danger" : index > 1 ? "warning" : "info"}>monitoring</Badge>
              <p className="text-lg font-semibold text-foreground">{item}</p>
              <p className="text-sm text-muted">Demo signal for admin review.</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>AI decision format</CardTitle>
              <CardDescription>Internal structured fields, not client-facing text.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {decisionFields.map((field) => (
                <div className="rounded-lg border border-border/80 bg-background p-4 font-mono text-sm text-foreground" key={field}>
                  {field}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Time rules</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {timeRules.map((rule, index) => (
                <div className="flex gap-3 rounded-lg border border-border/80 bg-background p-4 text-sm" key={rule}>
                  <Badge variant={index > 1 ? "warning" : "info"}>{index + 1}</Badge>
                  <p className="font-semibold text-foreground">{rule}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Demo risk cards from data layer</CardTitle>
              <CardDescription>AI recommendations demo: {recommendations.length}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {orders.map((order, index) => {
                const risk = getRisk(index, order.deliveryStatus);

                return (
                  <div className="rounded-lg border border-border/80 bg-background p-4" key={order.id}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-foreground">{order.id}</p>
                        <p className="text-sm text-muted">{order.status} · {order.deliveryStatus ?? "no delivery"}</p>
                      </div>
                      <Badge variant={riskVariant[risk]}>{risk}</Badge>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6">
          <AdminAiDispatcherDemoActions />

          <Card className="border-danger/30 bg-danger/10">
            <CardHeader>
              <CardTitle>Safety rules</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {safetyRules.map((rule) => (
                <div className="rounded-md border border-danger/20 bg-surface p-3 text-sm font-medium text-foreground" key={rule}>
                  {rule}
                </div>
              ))}
            </CardContent>
            <CardFooter>
              <Button>Запустить проверку demo</Button>
              <Button variant="outline">Эскалировать админу demo</Button>
              <Button variant="outline">Предложить курьера demo</Button>
              <Button variant="danger">Создать internal alert demo</Button>
            </CardFooter>
          </Card>
        </aside>
      </div>
    </AdminLayout>
  );
}

function getRisk(index: number, deliveryStatus: string | undefined): RiskLevel {
  if (deliveryStatus === "cancelled") return "critical";
  if (deliveryStatus === "pending") return "high";
  if (index % 2 === 1 || deliveryStatus === "assigned") return "medium";
  return "low";
}
