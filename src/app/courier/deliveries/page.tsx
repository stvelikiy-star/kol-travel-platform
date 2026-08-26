import Link from "next/link";
import { CourierLayout } from "@/components/layout/CourierLayout";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { getCourierDeliveriesReadResult } from "@/lib/data/courier-deliveries-read";
import type { CourierDeliveryReadItem } from "@/lib/data/types";

type CourierDeliveryStatus =
  | "delivery_pending"
  | "courier_assigned"
  | "courier_accepted"
  | "courier_to_partner"
  | "picked_up"
  | "courier_to_client"
  | "delivered"
  | "delivery_failed";

const statusVariant: Record<CourierDeliveryStatus, BadgeVariant> = {
  delivery_pending: "muted",
  courier_assigned: "info",
  courier_accepted: "success",
  courier_to_partner: "warning",
  picked_up: "info",
  courier_to_client: "warning",
  delivered: "success",
  delivery_failed: "danger"
};

const statusLabel: Record<CourierDeliveryStatus, string> = {
  delivery_pending: "Ожидает назначения",
  courier_assigned: "Назначено",
  courier_accepted: "Принято курьером",
  courier_to_partner: "К партнёру",
  picked_up: "Заказ получен",
  courier_to_client: "К клиенту",
  delivered: "Доставлено",
  delivery_failed: "Проблема доставки"
};

export default async function CourierDeliveriesPage() {
  const readResult = await getCourierDeliveriesReadResult();
  const deliveries = readResult.deliveries;
  const unavailable = !readResult.ok && readResult.code !== "empty_result";
  const assigned = deliveries.filter((delivery) => ["assigned", "courier_assigned"].includes(delivery.status)).length;
  const inTransit = deliveries.filter((delivery) => ["courier_accepted", "courier_to_partner", "picked_up", "delivering", "courier_to_client"].includes(delivery.status)).length;
  const problems = deliveries.filter((delivery) => ["cancelled", "delivery_failed"].includes(delivery.status)).length;
  const sourceLabel = readResult.source === "supabase" ? "Мои назначения" : "Безопасное демо";

  return (
    <CourierLayout status={inTransit > 0 ? "busy" : "online"}>
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-secondary via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">KÖL Courier</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Доставки</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
            Здесь курьер видит только собственные назначения и их текущее состояние. Чужие заказы, маршруты и контакты не подставляются.
          </p>
        </div>
      </Card>

      <Card className={unavailable ? "border-danger/40 bg-danger/10" : "border-primary/25 bg-primary/10"}>
        <CardContent className="flex flex-wrap items-center gap-3 p-4 text-sm">
          <Badge variant={readResult.source === "supabase" ? "success" : "info"}>{sourceLabel}</Badge>
          <span className="text-foreground">
            {unavailable
              ? "Доставки временно недоступны. KÖL не расширяет доступ на чужие заказы."
              : readResult.source === "supabase"
                ? "Загружены доставки, назначенные текущему курьеру."
                : "Демо показывает рабочий интерфейс доставки без изменения production-данных."}
          </span>
        </CardContent>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Мои доставки" value={unavailable ? "—" : deliveries.length} tone="info" />
        <StatCard label="Назначено" value={unavailable ? "—" : assigned} tone="info" />
        <StatCard label="В пути" value={unavailable ? "—" : inTransit} tone="warning" />
        <StatCard label="Проблемы" value={unavailable ? "—" : problems} tone={problems > 0 ? "danger" : "success"} />
      </section>

      {unavailable ? (
        <Card className="border-danger/40 bg-danger/10">
          <CardContent className="p-5 text-sm font-medium leading-6 text-foreground">Данные текущих назначений недоступны. Общий список заказов не используется как замена.</CardContent>
        </Card>
      ) : null}

      {!unavailable && deliveries.length === 0 ? (
        <Card>
          <CardHeader>
            <Badge className="w-fit" variant="muted">Нет назначений</Badge>
            <CardTitle>Активных доставок пока нет</CardTitle>
            <CardDescription>Новые назначения появятся здесь после передачи заказа курьеру.</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <section className="grid gap-4">
        {deliveries.map((delivery) => {
          const status = mapDeliveryStatus(delivery.status);
          return (
            <Card key={delivery.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>{delivery.type === "food" ? "Доставка еды" : "Доставка магазина"}</CardTitle>
                    <CardDescription>{delivery.orderId}</CardDescription>
                  </div>
                  <Badge variant={statusVariant[status]}>{statusLabel[status]}</Badge>
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
                <Info label="Адреса и контакты" value="Показываются только после подтверждённого доступа" />
              </CardContent>
              <CardContent className="flex flex-wrap gap-2 pt-0">
                <ActionLink href={`/courier/deliveries/${delivery.orderId}`}>Открыть детали</ActionLink>
                <ActionLink href="/courier/active" variant="outline">Активная доставка</ActionLink>
                <ActionLink href="/courier/issues" variant="outline">Сообщить о проблеме</ActionLink>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <Card className="border-primary/20 bg-lake-light">
        <CardHeader>
          <CardTitle>Изменения статуса защищены</CardTitle>
          <CardDescription>Принятие доставки, получение заказа, завершение и регистрация проблемы выполняются только после проверки текущего назначения и допустимого перехода статуса. Курьер не меняет оплату заказа.</CardDescription>
        </CardHeader>
      </Card>
    </CourierLayout>
  );
}

function mapDeliveryStatus(status: CourierDeliveryReadItem["status"] | undefined): CourierDeliveryStatus {
  if (status === "assigned" || status === "courier_assigned") return "courier_assigned";
  if (status === "courier_accepted") return "courier_accepted";
  if (status === "courier_to_partner") return "courier_to_partner";
  if (status === "picked_up") return "picked_up";
  if (status === "delivering" || status === "courier_to_client") return "courier_to_client";
  if (status === "delivered" || status === "completed") return "delivered";
  if (status === "cancelled" || status === "delivery_failed") return "delivery_failed";
  return "delivery_pending";
}

function StatCard({ label, value, tone }: { label: string; value: string | number; tone: BadgeVariant }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <p className="text-sm font-medium text-muted">{label}</p>
        <p className="text-3xl font-semibold text-primary">{value}</p>
        <Badge variant={tone}>Доставка</Badge>
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="break-words font-semibold text-foreground">{value}</p>
    </div>
  );
}

function ActionLink({ children, href, variant = "primary" }: { children: React.ReactNode; href: string; variant?: "primary" | "outline" }) {
  return (
    <Link className={variant === "primary" ? "inline-flex min-h-11 items-center justify-center rounded-md border border-primary bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90" : "inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:border-primary hover:text-primary"} href={href}>
      {children}
    </Link>
  );
}
