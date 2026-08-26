import Link from "next/link";
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
          <Badge className="border-white/30 bg-white text-primary">KÖL Active Delivery</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Активная доставка</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
            Здесь курьер видит только своё текущее назначение. Чужие заказы не используются как запасной источник данных.
          </p>
        </div>
      </Card>

      {unavailable ? (
        <Card className="border-danger/40 bg-danger/10">
          <CardContent className="p-4 text-sm font-medium leading-6 text-foreground">
            Активная доставка сейчас недоступна. KÖL не подменяет её чужим заказом или вымышленными контактами.
          </CardContent>
        </Card>
      ) : null}

      {!unavailable && !activeDelivery ? (
        <Card>
          <CardHeader>
            <Badge className="w-fit" variant="muted">Нет активного назначения</Badge>
            <CardTitle>Активная доставка отсутствует</CardTitle>
            <CardDescription>У текущего курьера сейчас нет доставки в активном состоянии.</CardDescription>
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
            <Info label="ID доставки" value={delivery.id} />
            <Info label="Партнёр" value={delivery.partnerTitle ?? delivery.businessId} />
            <Info label="Тип" value={delivery.type} />
            <Info label="Статус заказа" value={delivery.status} />
            <Info label="Статус оплаты" value={delivery.paymentStatus} />
            <Info label="Сумма заказа" value={`${delivery.total} KGS`} />
            <Info label="Стоимость доставки" value={`${delivery.deliveryFee} KGS`} />
            <Info label="Обновлено" value={delivery.updatedAt} />
          </CardContent>
        </Card>

        <Card className="border-warning/35 bg-warning/10">
          <CardHeader>
            <CardTitle>Контакты и адреса показываются только после подтверждения</CardTitle>
            <CardDescription>
              Источник текущей доставки пока не подтверждает адрес выдачи, адрес клиента и контактные данные. Поэтому KÖL не показывает вымышленные значения.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <Info label="Адрес выдачи" value="Ожидает подключения подтверждённого источника" />
            <Info label="Контакт и адрес клиента" value="Ожидает подключения подтверждённого источника" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Этапы доставки</CardTitle>
            <CardDescription>Схема разрешённых состояний маршрута; фактический текущий статус выделен отдельно.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {lifecycle.map((step) => (
              <div className="rounded-lg border border-border bg-background p-4" key={step.status}>
                <Badge variant={step.status === currentStatus ? statusVariant[step.status] : "muted"}>{step.label}</Badge>
                <p className="mt-3 text-sm font-semibold text-foreground">{step.status === currentStatus ? "Текущий этап" : "Допустимый этап"}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle>Изменение статуса защищено</CardTitle>
            <CardDescription>
              Принять заказ, подтвердить получение и завершить доставку можно будет только через серверный процесс, который проверяет назначение курьера и допустимый переход состояния.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant="warning">Действия появятся после подключения рабочего контура</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Проблема на доставке</CardTitle>
            <CardDescription>Сообщение о проблеме будет сохраняться и передаваться администратору через отдельный канал эскалации.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary" href="/courier/issues">
              Открыть правила эскалации
            </Link>
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
