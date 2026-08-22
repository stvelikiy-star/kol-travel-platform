import { CourierLayout } from "@/components/layout/CourierLayout";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { getCourierDeliveriesReadResult } from "@/lib/data/courier-deliveries-read";
import type { CourierDeliveryReadItem } from "@/lib/data/types";

type ActiveDeliveryStatus =
  | "courier_assigned"
  | "courier_accepted"
  | "courier_to_partner"
  | "picked_up"
  | "courier_to_client"
  | "delivered"
  | "delivery_failed";

const statusVariant: Record<ActiveDeliveryStatus, BadgeVariant> = {
  courier_assigned: "info",
  courier_accepted: "success",
  courier_to_partner: "warning",
  picked_up: "info",
  courier_to_client: "warning",
  delivered: "success",
  delivery_failed: "danger"
};

const lifecycle: Array<{ status: ActiveDeliveryStatus; label: string }> = [
  { status: "courier_assigned", label: "Назначена курьеру" },
  { status: "courier_accepted", label: "Принята курьером" },
  { status: "courier_to_partner", label: "К партнёру" },
  { status: "picked_up", label: "Заказ получен" },
  { status: "courier_to_client", label: "К клиенту" },
  { status: "delivered", label: "Доставлено" }
];

const activeStatuses = new Set([
  "assigned",
  "courier_assigned",
  "courier_accepted",
  "courier_to_partner",
  "picked_up",
  "delivering",
  "courier_to_client"
]);

export default async function CourierActiveDeliveryPage() {
  const readResult = await getCourierDeliveriesReadResult();
  const unavailable = !readResult.ok && readResult.code !== "empty_result";
  const activeDelivery = readResult.deliveries.find((delivery) => activeStatuses.has(delivery.status));

  return (
    <CourierLayout status={activeDelivery ? "busy" : "online"}>
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-secondary via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">Scoped courier delivery</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Активная доставка</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
            Страница использует только доставки, назначенные текущему авторизованному курьеру. Общий список заказов здесь не используется.
          </p>
        </div>
      </Card>

      {unavailable ? (
        <Card className="border-danger/40 bg-danger/10">
          <CardContent className="p-4 text-sm font-medium leading-6 text-foreground">
            Активная доставка сейчас недоступна. KÖL не подменяет её чужим заказом или mock-контактом.
          </CardContent>
        </Card>
      ) : null}

      {!unavailable && !activeDelivery ? (
        <Card>
          <CardHeader>
            <Badge className="w-fit" variant="muted">Нет активного назначения</Badge>
            <CardTitle>Активная доставка отсутствует</CardTitle>
            <CardDescription>Для текущего courier scope нет доставки в активном состоянии.</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {activeDelivery ? <ActiveDelivery delivery={activeDelivery} /> : null}
    </CourierLayout>
  );
}

function ActiveDelivery({ delivery }: { delivery: CourierDeliveryReadItem }) {
  const currentStatus = mapDeliveryStatus(delivery.status);

  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-5">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>{delivery.type === "food" ? "Доставка еды" : "Доставка магазина"}</CardTitle>
                <CardDescription>{delivery.orderId}</CardDescription>
              </div>
              <Badge variant={statusVariant[currentStatus]}>{currentStatus}</Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Info label="Delivery ID" value={delivery.id} />
            <Info label="Партнёр" value={delivery.partnerTitle ?? delivery.businessId} />
            <Info label="Тип" value={delivery.type} />
            <Info label="Статус заказа" value={delivery.status} />
            <Info label="Статус оплаты" value={delivery.paymentStatus} />
            <Info label="Сумма заказа" value={`${delivery.total} KGS`} />
            <Info label="Delivery fee" value={`${delivery.deliveryFee} KGS`} />
            <Info label="Обновлено" value={delivery.updatedAt} />
          </CardContent>
        </Card>

        <Card className="border-warning/35 bg-warning/10">
          <CardHeader>
            <CardTitle>Контакты и адреса не подменяются</CardTitle>
            <CardDescription>
              Scoped reader пока не подтверждает адрес выдачи, адрес клиента и контактные данные. Поэтому KÖL не показывает вымышленные значения.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <Info label="Pickup address" value="Не подключён scoped contact reader" />
            <Info label="Client contact/address" value="Не подключён scoped contact reader" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Допустимый lifecycle</CardTitle>
            <CardDescription>Это схема допустимых состояний, а не вымышленная история текущей доставки.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {lifecycle.map((step) => (
              <div className="rounded-lg border border-border bg-background p-4" key={step.status}>
                <Badge variant={step.status === currentStatus ? statusVariant[step.status] : "muted"}>{step.status}</Badge>
                <p className="mt-3 text-sm font-semibold text-foreground">{step.label}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle>Действия пока read-only</CardTitle>
            <CardDescription>
              Accept / pickup / delivered появятся только через серверные courier RPC с проверкой назначения, перехода статуса и audit log.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant="warning">Неподтверждённые write-кнопки отключены</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Проблема на доставке</CardTitle>
            <CardDescription>До подключения ticket/escalation backend страница проблем работает fail-closed.</CardDescription>
          </CardHeader>
          <CardContent>
            <a className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary" href="/courier/issues">
              Открыть правила эскалации
            </a>
          </CardContent>
        </Card>
      </aside>
    </section>
  );
}

function mapDeliveryStatus(status: string | undefined): ActiveDeliveryStatus {
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
      <p className="text-xs text-muted">{label}</p>
      <p className="break-words font-semibold text-foreground">{value}</p>
    </div>
  );
}
