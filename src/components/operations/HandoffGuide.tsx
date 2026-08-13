import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

type HandoffGuideProps = {
  mode: "partner" | "courier";
};

const handoffStatuses = [
  "new_order",
  "accepted_by_partner",
  "preparing",
  "ready_for_pickup",
  "courier_assigned",
  "courier_to_partner",
  "picked_up",
  "courier_to_client",
  "delivered",
  "issue_reported",
  "admin_required"
];

const partnerResponsibility = [
  "accept or reject order",
  "prepare order",
  "mark ready_for_pickup",
  "keep order packed and available for courier",
  "report issue if courier does not arrive"
];

const partnerAfterPickup = [
  "cannot cancel order",
  "cannot change delivery status",
  "cannot change payment status",
  "can only contact admin/support"
];

const courierResponsibility = [
  "accept assigned delivery",
  "go to partner",
  "pick up order",
  "confirm pickup",
  "go to client",
  "deliver order",
  "report issue if needed"
];

const courierCannot = [
  "cannot change payment status",
  "cannot change order items",
  "cannot cancel order",
  "cannot change partner preparation status"
];

const delayCases = [
  "courier is assigned but not moving",
  "ready_for_pickup waits too long",
  "partner reports courier delay",
  "courier reports partner point problem",
  "client address/contact problem"
];

const aiSafety = [
  "AI can detect delay",
  "AI can recommend courier reassignment",
  "AI can alert admin",
  "AI can draft message to partner/courier/client",
  "AI cannot cancel order",
  "AI cannot change payment status",
  "AI cannot enable alcohol module"
];

export function HandoffGuide({ mode }: HandoffGuideProps) {
  const isPartner = mode === "partner";

  return (
    <Card className="border-primary/30 bg-surface/95 shadow-card">
      <CardHeader className="space-y-3 pb-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant="info">handoff</Badge>
          <Badge variant="warning">ready_for_pickup → picked_up</Badge>
          <Badge variant="muted">demo UX</Badge>
        </div>
        <div>
          <CardTitle className="text-base">
            {isPartner ? "Передача заказа курьеру" : "Получение заказа у партнёра"}
          </CardTitle>
          <CardDescription>
            {isPartner
              ? "Зона партнёра заканчивается, когда курьер забрал заказ и статус стал picked_up / handed_to_courier."
              : "Зона курьера начинается, когда доставка назначена или принята, и продолжается до delivered."}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border border-border bg-background/80 p-3">
          <p className="mb-3 text-sm font-semibold text-foreground">Handoff statuses</p>
          <div className="flex flex-wrap gap-2">
            {handoffStatuses.map((status) => (
              <Badge
                key={status}
                variant={status === "ready_for_pickup" ? "warning" : status === "picked_up" ? "success" : status === "admin_required" ? "danger" : "muted"}
              >
                {status}
              </Badge>
            ))}
          </div>
        </div>

        {isPartner ? (
          <>
            <GuideSection title="Зона ответственности партнёра" items={partnerResponsibility} tone="success" />
            <GuideSection title="После передачи курьеру" items={partnerAfterPickup} tone="warning" />
          </>
        ) : (
          <>
            <GuideSection title="Зона ответственности курьера" items={courierResponsibility} tone="success" />
            <GuideSection title="Курьер не отвечает за" items={courierCannot} tone="danger" />
          </>
        )}

        <GuideSection title={isPartner ? "Если курьер задерживается" : "Проблема на точке партнёра / у клиента"} items={delayCases} tone="warning" />
        <GuideSection title="AI-диспетчер и админ" items={aiSafety} tone="info" />

        <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm leading-6 text-foreground">
          ALCOHOL_MODULE_ENABLED=false. Alcohol sales/delivery disabled. Any future alcohol activation requires legal review, licensing,
          partner verification and super_admin approval.
        </div>
      </CardContent>
    </Card>
  );
}

function GuideSection({ items, title, tone }: { items: string[]; title: string; tone: "success" | "danger" | "warning" | "info" }) {
  return (
    <div className="rounded-md border border-border bg-background/80 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <Badge variant={tone}>{tone}</Badge>
      </div>
      <ul className="space-y-1 text-sm leading-5 text-muted">
        {items.map((item) => (
          <li className="break-words" key={item}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
