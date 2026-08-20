import type { ReactNode } from "react";
import { CourierLayout } from "@/components/layout/CourierLayout";
import { CourierOperationalFinalPanel } from "@/app/courier/_components/CourierOperationalFinalPanel";
import { CourierIssueEscalationPanel } from "@/app/courier/_components/CourierIssueEscalationPanel";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { getDeliveries, getDeliveryByOrderId, getDeliveryOrderById, getDeliveryRiskLevel } from "@/lib/data/delivery";
import type { Order } from "@/types";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type CourierDeliveryStatus =
  | "courier_assigned"
  | "courier_accepted"
  | "courier_to_partner"
  | "picked_up"
  | "courier_to_client"
  | "delivered"
  | "delivery_failed";

type RiskLevel = "low" | "medium" | "high" | "critical";

const statusVariant: Record<CourierDeliveryStatus, BadgeVariant> = {
  courier_assigned: "info",
  courier_accepted: "success",
  courier_to_partner: "warning",
  picked_up: "info",
  courier_to_client: "warning",
  delivered: "success",
  delivery_failed: "danger"
};

const riskVariant: Record<RiskLevel, BadgeVariant> = {
  low: "success",
  medium: "warning",
  high: "danger",
  critical: "danger"
};

const timeline: Array<{ status: CourierDeliveryStatus; label: string; description: string }> = [
  { status: "courier_assigned", label: "Курьер назначен", description: "Доставка назначена курьеру в demo mode." },
  { status: "courier_accepted", label: "Курьер принял", description: "Курьер подтвердил готовность выполнить доставку." },
  { status: "courier_to_partner", label: "Едет к партнёру", description: "Курьер направляется к точке выдачи партнёра." },
  { status: "picked_up", label: "Заказ забран", description: "Курьер забрал заказ у партнёра." },
  { status: "courier_to_client", label: "Едет к клиенту", description: "Курьер везёт заказ клиенту." },
  { status: "delivered", label: "Доставлено", description: "Физическая доставка завершена." }
];

export function generateStaticParams() {
  return getDeliveries().map((delivery) => ({
    id: delivery.orderId
  }));
}

export default async function CourierDeliveryDetailPage({ params }: PageProps) {
  const { id } = await params;
  const delivery = getDeliveryByOrderId(id);
  const order = getDeliveryOrderById(id);

  if (!order || !delivery) {
    return (
      <CourierLayout status="online">
        <NotFoundState />
      </CourierLayout>
    );
  }

  const deliveryStatus = mapDeliveryStatus(order);
  const risk = getDeliveryRiskLevel(order);
  const activeStepIndex = timeline.findIndex((step) => step.status === deliveryStatus);

  return (
    <CourierLayout status={deliveryStatus === "delivered" ? "online" : "busy"}>
      <CourierOperationalFinalPanel context="delivery-detail" />
      <CourierIssueEscalationPanel context="delivery-detail" />

      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-muted">
          <BreadcrumbLink href="/courier">Кабинет курьера</BreadcrumbLink>
          <span>/</span>
          <BreadcrumbLink href="/courier/deliveries">Доставки</BreadcrumbLink>
          <span>/</span>
          <span className="text-foreground">Детали</span>
        </div>

        <Card className="overflow-hidden">
          <div className="bg-gradient-to-br from-secondary via-primary to-accent p-6 text-white">
            <div className="flex flex-wrap gap-2">
              <Badge className="border-white/30 bg-white text-primary">Delivery detail</Badge>
              <Badge variant={statusVariant[deliveryStatus]}>{deliveryStatus}</Badge>
              <Badge variant={riskVariant[risk]}>{risk} risk</Badge>
            </div>
            <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Детали доставки</h2>
            <p className="mt-2 text-sm text-white/85">{order.id}</p>
          </div>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <section className="grid gap-4 md:grid-cols-2">
              <InfoCard title="Партнёр" badge="pickup">
                <InfoRow label="Partner demo" value={order.businessId} />
                <InfoRow label="Pickup address" value="Чолпон-Ата, partner pickup point" />
                <InfoRow label="Contact demo" value="+996 700 000 101" />
                <InfoRow label="Preparation status" value={order.status === "ready" ? "ready_for_pickup" : "preparing demo"} />
              </InfoCard>

              <InfoCard title="Клиент" badge="delivery">
                <InfoRow label="Client demo" value={`Client ${order.clientUserId.replace("client-", "")}`} />
                <InfoRow label="Delivery address" value="Иссык-Куль, demo delivery address" />
                <InfoRow label="Contact demo" value="+996 700 000 202" />
                <InfoRow label="Instructions" value="Позвонить за 5 минут до прибытия." />
              </InfoCard>
            </section>

            <Card>
              <CardHeader>
                <CardTitle>Позиции заказа</CardTitle>
                <CardDescription>Курьер видит состав доставки, но не меняет позиции заказа.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {order.items.map((item) => (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background p-4" key={item.id}>
                    <div>
                      <p className="font-semibold text-foreground">{item.title}</p>
                      <p className="text-sm text-muted">{item.itemType} · x{item.quantity}</p>
                    </div>
                    <p className="font-semibold text-primary">{item.totalPrice} {order.currency}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Статус доставки</CardTitle>
                <CardDescription>Demo timeline физической доставки курьером.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {timeline.map((step, index) => {
                  const state = index < activeStepIndex || deliveryStatus === "delivered" ? "done" : index === activeStepIndex ? "current" : "upcoming";

                  return (
                    <div className="grid gap-3 rounded-lg border border-border bg-background p-4 sm:grid-cols-[160px_minmax(0,1fr)]" key={step.status}>
                      <div className="flex items-center gap-2">
                        <Badge variant={state === "done" ? "success" : state === "current" ? "info" : "muted"}>{state}</Badge>
                        <span className="text-sm font-semibold text-foreground">{step.status}</span>
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{step.label}</p>
                        <p className="text-sm text-muted">{step.description}</p>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card className="border-warning/40 bg-warning/10">
              <CardHeader>
                <CardTitle>Правила курьера</CardTitle>
                <CardDescription>Курьер управляет только физической доставкой.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm font-medium text-foreground">
                <Rule>Курьер не меняет payment status.</Rule>
                <Rule>Курьер не меняет состав заказа.</Rule>
                <Rule>Courier cannot change order items.</Rule>
                <Rule>Курьер не отменяет заказ без админа KÖL.</Rule>
                <Rule>Alcohol delivery remains OFF by default.</Rule>
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Delivery summary</CardTitle>
                <CardDescription>Финансы показаны только как demo.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoRow label="Order type" value={order.type} />
                <InfoRow label="Payment method" value={order.paymentStatus} />
                <InfoRow label="Total" value={`${order.total} ${order.currency}`} />
                <InfoRow label="Courier earning demo" value={`${Math.round(order.total * 0.08)} ${order.currency}`} />
                <InfoRow label="Distance/time demo" value="6 км · 28 мин" />
              </CardContent>
              <CardFooter>
                <Button>Принял доставку demo</Button>
                <Button variant="outline">Еду к партнёру demo</Button>
                <Button variant="outline">Забрал заказ demo</Button>
                <Button variant="outline">В пути к клиенту demo</Button>
                <Button variant="secondary">Доставлено demo</Button>
                <StyledLink href="/courier/issues">Проблема demo</StyledLink>
              </CardFooter>
            </Card>
          </aside>
        </div>
      </div>
    </CourierLayout>
  );
}

function mapDeliveryStatus(order: Order): CourierDeliveryStatus {
  if (order.deliveryStatus === "assigned") return "courier_assigned";
  if (order.deliveryStatus === "picked_up") return "picked_up";
  if (order.deliveryStatus === "delivering") return "courier_to_client";
  if (order.deliveryStatus === "delivered") return "delivered";
  if (order.deliveryStatus === "cancelled") return "delivery_failed";
  return "courier_assigned";
}

function InfoCard({ badge, children, title }: { badge: string; children: ReactNode; title: string }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>{title}</CardTitle>
          <Badge variant="info">{badge}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 font-semibold text-foreground">{value}</p>
    </div>
  );
}

function Rule({ children }: { children: ReactNode }) {
  return <div className="rounded-md border border-warning/30 bg-surface p-3">{children}</div>;
}

function StyledLink({ children, href }: { children: ReactNode; href: string }) {
  return (
    <a
      className="inline-flex min-h-11 items-center justify-center rounded-md border border-primary bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
      href={href}
    >
      {children}
    </a>
  );
}

function BreadcrumbLink({ children, href }: { children: ReactNode; href: string }) {
  return (
    <a className="rounded-md px-2 py-1 text-primary transition hover:bg-primary/10" href={href}>
      {children}
    </a>
  );
}

function NotFoundState() {
  return (
    <Card>
      <CardHeader>
        <Badge variant="warning">not found</Badge>
        <CardTitle>Доставка не найдена</CardTitle>
        <CardDescription>Такой demo-заказ не найден или у него нет delivery status.</CardDescription>
      </CardHeader>
      <CardFooter>
        <StyledLink href="/courier/deliveries">Вернуться к доставкам</StyledLink>
      </CardFooter>
    </Card>
  );
}
