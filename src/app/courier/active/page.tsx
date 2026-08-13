import { CourierLayout } from "@/components/layout/CourierLayout";
import { CourierOperationalFinalPanel } from "@/app/courier/_components/CourierOperationalFinalPanel";
import { CourierIssueEscalationPanel } from "@/app/courier/_components/CourierIssueEscalationPanel";
import { CourierActiveDemoActions } from "@/app/courier/active/CourierActiveDemoActions";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { getDeliveryOrders } from "@/lib/data/orders";

type ActiveDeliveryStatus =
  | "courier_assigned"
  | "courier_accepted"
  | "courier_to_partner"
  | "picked_up"
  | "courier_to_client"
  | "delivered";

const timeline: Array<{ status: ActiveDeliveryStatus; description: string }> = [
  { status: "courier_assigned", description: "Доставка назначена курьеру." },
  { status: "courier_accepted", description: "Курьер принял доставку." },
  { status: "courier_to_partner", description: "Курьер едет к партнёру." },
  { status: "picked_up", description: "Курьер забрал заказ." },
  { status: "courier_to_client", description: "Курьер едет к клиенту." },
  { status: "delivered", description: "Заказ доставлен клиенту." }
];

const statusVariant: Record<ActiveDeliveryStatus, BadgeVariant> = {
  courier_assigned: "info",
  courier_accepted: "success",
  courier_to_partner: "warning",
  picked_up: "info",
  courier_to_client: "warning",
  delivered: "success"
};

const deliveryOrders = getDeliveryOrders();
const activeOrder = deliveryOrders.find((order) => order.deliveryStatus === "assigned") ?? deliveryOrders[0];
const currentStatus: ActiveDeliveryStatus = activeOrder.deliveryStatus === "delivered" ? "delivered" : activeOrder.deliveryStatus === "picked_up" ? "picked_up" : "courier_assigned";

export default function CourierActiveDeliveryPage() {
  return (
    <CourierLayout status="busy">
      <CourierOperationalFinalPanel context="active" />
      <CourierIssueEscalationPanel context="active" />

      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-secondary via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">Active delivery</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Активная доставка</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
            Demo экран текущей доставки: адреса, контактные данные, статусы и действия курьера.
          </p>
        </div>
      </Card>

      <Card className="border-warning/40 bg-warning/10">
        <CardContent className="p-4 text-sm font-medium text-foreground">
          Demo active delivery. Реальная геолокация, звонки, подтверждение доставки и уведомления будут подключены позже.
        </CardContent>
      </Card>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>Активный заказ</CardTitle>
                  <CardDescription>{activeOrder.id}</CardDescription>
                </div>
                <Badge variant={statusVariant[currentStatus]}>{currentStatus}</Badge>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <Info label="Order type" value={activeOrder.type} />
              <Info label="Payment method" value={activeOrder.paymentStatus} />
              <Info label="Total" value={`${activeOrder.total} ${activeOrder.currency}`} />
            </CardContent>
          </Card>

          <section className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Pickup block</CardTitle>
                <CardDescription>Данные партнёра для получения заказа.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Info label="Partner name" value={activeOrder.businessId} />
                <Info label="Pickup address" value="Чолпон-Ата, partner pickup point" />
                <Info label="Partner contact demo" value="+996 700 100 200" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Client block</CardTitle>
                <CardDescription>Данные клиента для доставки.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Info label="Client demo name" value={`Client demo ${activeOrder.clientUserId.replace("client-", "")}`} />
                <Info label="Client address" value="Бостери, demo street 12" />
                <Info label="Client contact demo" value="+996 700 300 400" />
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardHeader>
              <CardTitle>Order items</CardTitle>
              <CardDescription>Курьер проверяет количество мест, но не меняет состав заказа.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeOrder.items.map((item) => (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background p-4" key={item.id}>
                  <div>
                    <p className="font-semibold text-foreground">{item.title}</p>
                    <p className="text-sm text-muted">{item.itemType} · {item.itemId}</p>
                  </div>
                  <p className="text-sm font-semibold text-foreground">x{item.quantity}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Delivery timeline</CardTitle>
              <CardDescription>Demo статусы активной доставки.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {timeline.map((step) => (
                <div className="rounded-lg border border-border bg-background p-4" key={step.status}>
                  <Badge variant={step.status === currentStatus ? statusVariant[step.status] : "muted"}>
                    {step.status}
                  </Badge>
                  <p className="mt-3 text-sm leading-6 text-muted">{step.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
          <CourierActiveDemoActions />

          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle>AI dispatcher note</CardTitle>
              <CardDescription>
                AI-диспетчер отслеживает задержки и поднимает проблему админу.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-warning/40 bg-warning/10">
            <CardHeader>
              <CardTitle>Important warning</CardTitle>
              <CardDescription>
                Courier controls only physical delivery. Courier cannot change payment,
                order contents, partner preparation status, or alcohol module.
              </CardDescription>
            </CardHeader>
          </Card>
        </aside>
      </section>
    </CourierLayout>
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
