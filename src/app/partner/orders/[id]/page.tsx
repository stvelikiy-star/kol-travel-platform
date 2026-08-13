import type { ReactNode } from "react";
import { PartnerLayout } from "@/components/layout/PartnerLayout";
import { PartnerIssueEscalationPanel } from "@/app/partner/_components/PartnerIssueEscalationPanel";
import { PartnerOrderActions } from "@/components/partner/PartnerOrderActions";
import { PartnerStatusTimeline, type PartnerTimelineStep } from "@/components/partner/PartnerStatusTimeline";
import { PartnerWarningCard } from "@/components/partner/PartnerWarningCard";
import { OrderStatusBadge } from "@/components/status/OrderStatusBadge";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { getOrderById, getPartnerOrders } from "@/lib/data/orders";
import type { Order } from "@/types";

type PartnerOrderDetailPageProps = {
  params: {
    id: string;
  };
};

const deliveryTimeline = [
  { label: "new", description: "Order created and waiting for partner decision." },
  { label: "partner_accepted", description: "Partner accepted the order into preparation." },
  { label: "preparing", description: "Partner is preparing food or assembling shop items." },
  { label: "ready_for_pickup", description: "Partner marked the order ready for courier pickup." },
  { label: "courier_assigned", description: "Courier or dispatcher owns the next delivery step." },
  { label: "picked_up", description: "Courier picked up the order from partner." },
  { label: "delivered", description: "Courier delivered the order to client." }
];

export function generateStaticParams() {
  return getPartnerOrders().map((order) => ({ id: order.id }));
}

export default function PartnerOrderDetailPage({ params }: PartnerOrderDetailPageProps) {
  const order = getOrderById(params.id);

  if (!order) {
    return (
      <PartnerLayout>
        <NotFoundState />
      </PartnerLayout>
    );
  }

  return (
    <PartnerLayout>
      <Breadcrumb current="Заказ" parentHref="/partner/orders" parentLabel="Заказы" />
      <PartnerIssueEscalationPanel context="order-detail" />

      <PartnerWarningCard
        description="Partner controls only preparation. After “Готов к выдаче”, courier, AI dispatcher and KÖL admin control delivery."
        title="Delivery responsibility"
        tone="warning"
      />

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Badge variant="info">Partner order detail</Badge>
                  <CardTitle className="mt-3 text-2xl">Детали заказа</CardTitle>
                  <CardDescription>{order.id}</CardDescription>
                </div>
                <OrderStatusBadge status={order.status} />
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <Info label="Client demo" value={clientName(order.clientUserId)} />
              <Info label="Order type" value={order.type === "food" ? "food" : "shop"} />
              <Info label="Payment method" value={order.paymentStatus} />
              <Info label="Delivery / pickup" value={order.deliveryStatus ? "delivery demo" : "pickup demo"} />
              <Info label="Partner preparation status" value={preparationStatus(order)} />
              <Info label="Delivery status demo" value={order.deliveryStatus ?? "not assigned"} />
              <Info label="Pickup address demo" value="Чолпон-Ата, partner pickup point" />
              <Info label="Created date" value={new Date(order.createdAt).toLocaleString("ru-RU")} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Позиции заказа</CardTitle>
              <CardDescription>Партнёр готовит только позиции своего бизнеса.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {order.items.map((item) => (
                <div
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background p-4"
                  key={item.id}
                >
                  <div>
                    <p className="font-semibold text-foreground">{item.title}</p>
                    <p className="text-sm text-muted">{item.itemType} · {item.itemId}</p>
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    {item.quantity} × {item.unitPrice} = {item.totalPrice} {order.currency}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <PartnerStatusTimeline
            description="Delivery chain from partner preparation to courier completion."
            steps={buildOrderTimeline(order)}
            title="Status timeline"
          />

          <div className="grid gap-5 lg:grid-cols-2">
            <PartnerWarningCard
              description="Allowed partner actions in demo CRM."
              items={[
                "accept/reject new order",
                "prepare order",
                "mark ready for pickup",
                "report problem"
              ]}
              title="What partner can do"
              tone="success"
            />
            <PartnerWarningCard
              description="Actions reserved for courier, AI dispatcher, admin or future compliance modules."
              items={[
                "close courier delivery",
                "change payment status",
                "cancel after courier pickup without admin",
                "enable alcohol delivery"
              ]}
              title="What partner cannot do"
              tone="danger"
            />
          </div>
        </div>

        <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
          <OrderSummary order={order} />
          <PartnerOrderActions backHref="/partner/orders" />
        </aside>
      </section>
    </PartnerLayout>
  );
}

function OrderSummary({ order }: { order: Order }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Summary</CardTitle>
        <CardDescription>Order financial demo overview.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <SummaryRow label="Subtotal" value={`${order.subtotal} ${order.currency}`} />
        <SummaryRow label="Delivery" value={`${order.deliveryFee} ${order.currency}`} />
        <SummaryRow label="Total" strong value={`${order.total} ${order.currency}`} />
      </CardContent>
    </Card>
  );
}

function Breadcrumb({ current, parentHref, parentLabel }: { current: string; parentHref: string; parentLabel: string }) {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-2 p-4 text-sm font-medium text-muted">
        <StyledCrumb href="/partner">Кабинет партнёра</StyledCrumb>
        <span>/</span>
        <StyledCrumb href={parentHref}>{parentLabel}</StyledCrumb>
        <span>/</span>
        <span className="text-foreground">{current}</span>
      </CardContent>
    </Card>
  );
}

function StyledCrumb({ children, href }: { children: ReactNode; href: string }) {
  return (
    <a className="font-semibold text-primary transition hover:opacity-80" href={href}>
      {children}
    </a>
  );
}

function StyledLink({ children, href }: { children: ReactNode; href: string }) {
  return (
    <a
      className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:border-primary hover:text-primary"
      href={href}
    >
      {children}
    </a>
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

function SummaryRow({ label, strong, value }: { label: string; strong?: boolean; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted">{label}</span>
      <span className={strong ? "text-lg font-semibold text-primary" : "font-semibold text-foreground"}>{value}</span>
    </div>
  );
}

function NotFoundState() {
  return (
    <Card>
      <CardHeader>
        <Badge className="w-fit" variant="warning">Not found</Badge>
        <CardTitle>Заказ не найден</CardTitle>
        <CardDescription>В demo data нет заказа с таким ID.</CardDescription>
      </CardHeader>
      <CardFooter>
        <StyledLink href="/partner/orders">Вернуться к заказам</StyledLink>
      </CardFooter>
    </Card>
  );
}

function clientName(clientUserId: string) {
  return `Client demo ${clientUserId.replace("client-", "")}`;
}

function preparationStatus(order: Order) {
  if (order.status === "assembling") {
    return "assembling";
  }

  if (order.status === "accepted" || order.status === "preparing" || order.status === "ready") {
    return order.status;
  }

  return "not in preparation";
}

function deliveryStep(order: Order) {
  if (order.deliveryStatus === "delivered" || order.status === "completed") {
    return "delivered";
  }

  if (order.deliveryStatus === "picked_up" || order.status === "delivering") {
    return "picked_up";
  }

  if (order.deliveryStatus === "assigned") {
    return "courier_assigned";
  }

  if (order.status === "ready") {
    return "ready_for_pickup";
  }

  if (order.status === "preparing" || order.status === "assembling") {
    return "preparing";
  }

  if (order.status === "accepted") {
    return "partner_accepted";
  }

  return "new";
}

function buildOrderTimeline(order: Order): PartnerTimelineStep[] {
  const currentIndex = deliveryTimeline.findIndex((step) => step.label === deliveryStep(order));

  return deliveryTimeline.map((step, index) => ({
    ...step,
    status: index < currentIndex ? "done" : index === currentIndex ? "current" : "upcoming"
  }));
}
