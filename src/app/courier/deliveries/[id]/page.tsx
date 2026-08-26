import type { ReactNode } from "react";
import { CourierLayout } from "@/components/layout/CourierLayout";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { getCourierDeliveriesReadResult } from "@/lib/data/courier-deliveries-read";
import type { CourierDeliveryReadItem } from "@/lib/data/types";

type PageProps = {
  params: Promise<{ id: string }>;
};

type CourierDeliveryStatus =
  | "courier_assigned"
  | "courier_accepted"
  | "courier_to_partner"
  | "picked_up"
  | "courier_to_client"
  | "delivered"
  | "delivery_failed";

const statusVariant: Record<CourierDeliveryStatus, BadgeVariant> = {
  courier_assigned: "info",
  courier_accepted: "success",
  courier_to_partner: "warning",
  picked_up: "info",
  courier_to_client: "warning",
  delivered: "success",
  delivery_failed: "danger"
};

const lifecycle: Array<{ status: CourierDeliveryStatus; label: string }> = [
  { status: "courier_assigned", label: "Назначена" },
  { status: "courier_accepted", label: "Принята" },
  { status: "courier_to_partner", label: "К партнёру" },
  { status: "picked_up", label: "Получена" },
  { status: "courier_to_client", label: "К клиенту" },
  { status: "delivered", label: "Доставлена" }
];

export default async function CourierDeliveryDetailPage({ params }: PageProps) {
  const { id } = await params;
  const readResult = await getCourierDeliveriesReadResult();
  const unavailable = !readResult.ok && readResult.code !== "empty_result";
  const delivery = readResult.deliveries.find((item) => item.orderId === id || item.id === id);

  if (unavailable) {
    return (
      <CourierLayout status="online">
        <StateCard title="Детали доставки недоступны" description="Scoped courier read завершился ошибкой. Общий orders-каталог не используется как fallback." tone="danger" />
      </CourierLayout>
    );
  }

  if (!delivery) {
    return (
      <CourierLayout status="online">
        <StateCard title="Доставка не найдена в courier scope" description="Запись либо не существует, либо не назначена текущему курьеру. KÖL не раскрывает чужую доставку." tone="warning" />
      </CourierLayout>
    );
  }

  const status = mapDeliveryStatus(delivery.status);

  return (
    <CourierLayout status={status === "delivered" ? "online" : "busy"}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-muted">
          <BreadcrumbLink href="/courier">Кабинет курьера</BreadcrumbLink>
          <span>/</span>
          <BreadcrumbLink href="/courier/deliveries">Доставки</BreadcrumbLink>
          <span>/</span>
          <span className="text-foreground">{delivery.orderId}</span>
        </div>

        <Card className="overflow-hidden">
          <div className="bg-gradient-to-br from-secondary via-primary to-accent p-6 text-white">
            <div className="flex flex-wrap gap-2">
              <Badge className="border-white/30 bg-white text-primary">Scoped delivery detail</Badge>
              <Badge variant={statusVariant[status]}>{status}</Badge>
            </div>
            <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Детали доставки</h2>
            <p className="mt-2 text-sm text-white/85">{delivery.orderId}</p>
          </div>
        </Card>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Info label="Delivery ID" value={delivery.id} />
          <Info label="Партнёр" value={delivery.partnerTitle ?? delivery.businessId} />
          <Info label="Тип" value={delivery.type} />
          <Info label="Order status" value={delivery.status} />
          <Info label="Payment status" value={delivery.paymentStatus} />
          <Info label="Total" value={`${delivery.total} KGS`} />
          <Info label="Delivery fee" value={`${delivery.deliveryFee} KGS`} />
          <Info label="Created" value={delivery.createdAt} />
          <Info label="Updated" value={delivery.updatedAt} />
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <Card className="border-warning/35 bg-warning/10">
              <CardHeader>
                <CardTitle>Адреса, контакты и состав заказа</CardTitle>
                <CardDescription>
                  Текущий scoped reader не подтверждает эти поля. Они не подтягиваются из generic order helper и не подменяются demo-значениями.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                <Info label="Pickup address/contact" value="Не подключён scoped reader" />
                <Info label="Client address/contact" value="Не подключён scoped reader" />
                <Info label="Order items" value="Не подключены к courier-scoped detail" />
                <Info label="Courier earning" value="Не рассчитывается без finance ledger" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Допустимый lifecycle</CardTitle>
                <CardDescription>Схема состояний, а не история конкретной доставки.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {lifecycle.map((step) => (
                  <div className="rounded-lg border border-border bg-background p-4" key={step.status}>
                    <Badge variant={step.status === status ? statusVariant[step.status] : "muted"}>{step.status}</Badge>
                    <p className="mt-3 text-sm font-semibold text-foreground">{step.label}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-4">
            <Card className="border-warning/35 bg-warning/10">
              <CardHeader>
                <CardTitle>Write actions закрыты</CardTitle>
                <CardDescription>
                  Accept / pickup / delivered требуют серверного RPC, проверки courier assignment, допустимого перехода статуса и audit log.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Badge variant="warning">Read-only до готовности RPC</Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Эскалация</CardTitle>
                <CardDescription>Проблемные случаи не меняют payment/order state из courier UI.</CardDescription>
              </CardHeader>
              <CardContent>
                <StyledLink href="/courier/issues">Правила эскалации</StyledLink>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </CourierLayout>
  );
}

function mapDeliveryStatus(status: CourierDeliveryReadItem["status"] | undefined): CourierDeliveryStatus {
  if (status === "courier_accepted") return "courier_accepted";
  if (status === "courier_to_partner") return "courier_to_partner";
  if (status === "picked_up") return "picked_up";
  if (status === "delivering" || status === "courier_to_client") return "courier_to_client";
  if (status === "delivered" || status === "completed") return "delivered";
  if (status === "cancelled" || status === "delivery_failed") return "delivery_failed";
  return "courier_assigned";
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 break-words font-semibold text-foreground">{value}</p>
    </div>
  );
}

function StateCard({ title, description, tone }: { title: string; description: string; tone: "warning" | "danger" }) {
  return (
    <Card className={tone === "danger" ? "border-danger/40 bg-danger/10" : "border-warning/40 bg-warning/10"}>
      <CardHeader>
        <Badge className="w-fit" variant={tone}>{tone}</Badge>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <StyledLink href="/courier/deliveries">Вернуться к доставкам</StyledLink>
      </CardContent>
    </Card>
  );
}

function StyledLink({ children, href }: { children: ReactNode; href: string }) {
  return <a className="inline-flex min-h-11 items-center justify-center rounded-md border border-primary bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90" href={href}>{children}</a>;
}

function BreadcrumbLink({ children, href }: { children: ReactNode; href: string }) {
  return <a className="rounded-md px-2 py-1 text-primary transition hover:bg-primary/10" href={href}>{children}</a>;
}
