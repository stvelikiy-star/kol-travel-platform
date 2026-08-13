import { PartnerLayout } from "@/components/layout/PartnerLayout";
import { PartnerIssueEscalationPanel } from "@/app/partner/_components/PartnerIssueEscalationPanel";
import { PartnerStatusTimeline } from "@/components/partner/PartnerStatusTimeline";
import { PartnerWarningCard } from "@/components/partner/PartnerWarningCard";
import { OrderStatusBadge } from "@/components/status/OrderStatusBadge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { getDeliveries } from "@/lib/data/delivery";
import { getPartnerOrders } from "@/lib/data/orders";

const deliveryChain = [
  { label: "Partner accepts order", description: "Партнёр принимает заказ в работу.", status: "done" as const },
  { label: "Partner prepares order", description: "Партнёр готовит или собирает позиции.", status: "current" as const },
  { label: "Partner marks ready for pickup", description: "После этого доставку ведут courier/AI/admin.", status: "upcoming" as const },
  { label: "AI dispatcher finds courier", description: "AI-диспетчер предлагает назначение курьера.", status: "upcoming" as const },
  { label: "Courier picks up order", description: "Курьер забирает заказ у партнёра.", status: "upcoming" as const },
  { label: "Courier delivers to client", description: "Курьер закрывает доставку клиенту.", status: "upcoming" as const }
];

export default function PartnerDeliveryPage() {
  const orders = getPartnerOrders();
  const deliveries = getDeliveries();
  const deliveryOrders = deliveries.flatMap((delivery) => {
    const order = orders.find((item) => item.id === delivery.orderId);
    return order ? [order] : [];
  });
  const preparing = orders.filter((order) => ["preparing", "assembling"].includes(order.status)).length;
  const readyForPickup = orders.filter((order) => order.status === "ready").length;
  const waitingCourier = orders.filter((order) => ["pending", "assigned"].includes(order.deliveryStatus ?? "")).length;
  const onTheWay = orders.filter((order) => ["picked_up", "delivering"].includes(order.deliveryStatus ?? "") || order.status === "delivering").length;

  return (
    <PartnerLayout>
      <PartnerIssueEscalationPanel context="delivery" />

      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-secondary via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">Delivery overview</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Доставка партнёра</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
            Партнёр не управляет курьерами напрямую. Партнёр контролирует только подготовку заказа и статус готовности к выдаче.
          </p>
        </div>
      </Card>

      <PartnerWarningCard
        description="После статуса “Готов к выдаче” доставку контролируют курьер, AI-диспетчер и админ KÖL."
        title="Важное правило доставки"
        tone="warning"
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Готовятся" value={preparing} />
        <StatCard label="Готовы к выдаче" value={readyForPickup} />
        <StatCard label="Ожидают курьера" value={waitingCourier} />
        <StatCard label="В пути" value={onTheWay} />
      </section>

      <PartnerStatusTimeline
        description="Операционная цепочка из delivery architecture docs."
        steps={deliveryChain}
        title="Delivery chain"
      />

      <section className="grid gap-4">
        {deliveryOrders.map((order, index) => (
          <Card key={order.id}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>{order.type === "food" ? "Доставка еды" : "Доставка магазина"}</CardTitle>
                  <p className="mt-1 text-sm text-muted">{order.id} · Client demo {index + 1}</p>
                </div>
                <OrderStatusBadge status={order.status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                <Info label="Preparation status" value={order.status} />
                <Info label="Delivery status demo" value={order.deliveryStatus ?? "delivery_pending"} />
                <Info label="Payment method" value={order.paymentStatus} />
                <Info label="Courier status demo" value={order.deliveryStatus === "delivered" ? "completed" : "searching/assigned"} />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Info label="Pickup address demo" value="Чолпон-Ата, partner pickup point" />
                <Info label="Created time demo" value={new Date(order.createdAt).toLocaleString("ru-RU")} />
              </div>
              <div className="rounded-lg border border-border bg-background p-4">
                <p className="text-sm font-semibold text-foreground">Items preview</p>
                <div className="mt-3 grid gap-2">
                  {order.items.map((item) => (
                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm" key={item.id}>
                      <span className="text-foreground">{item.title}</span>
                      <span className="text-muted">x{item.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button>Принять заказ demo</Button>
              <Button variant="outline">Готовится demo</Button>
              <Button variant="secondary">Готов к выдаче demo</Button>
              <Button variant="danger">Сообщить о проблеме demo</Button>
            </CardFooter>
          </Card>
        ))}
      </section>
    </PartnerLayout>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <p className="text-sm font-medium text-muted">{label}</p>
        <p className="text-3xl font-semibold text-primary">{value}</p>
        <Badge variant="muted">delivery demo</Badge>
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="font-semibold text-foreground">{value}</p>
    </div>
  );
}
