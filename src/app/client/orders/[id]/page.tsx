import { ClientLayout } from "@/components/layout/ClientLayout";
import { OrderStatusBadge, type ExtendedOrderStatus } from "@/components/status/OrderStatusBadge";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { getClientOrdersReadResult } from "@/lib/data/client-orders-read";
import type { ClientOrderReadItem, ClientOrdersReadResult } from "@/lib/data/types";

type OrderDetailPageProps = {
  params: {
    id: string;
  };
};

const foodStatusHistory: ExtendedOrderStatus[] = ["new", "accepted", "preparing", "ready", "delivering", "completed"];
const shopStatusHistory: ExtendedOrderStatus[] = ["new", "accepted", "assembling", "ready", "delivering", "completed"];

export default async function ClientOrderDetailPage({ params }: OrderDetailPageProps) {
  const readResult = await getClientOrdersReadResult();
  const order = readResult.orders.find((item) => item.id === params.id);

  if (!order) {
    return (
      <ClientLayout>
        <NotFoundState readResult={readResult} />
      </ClientLayout>
    );
  }

  const currentStatus = normalizeOrderStatus(order.status);
  const history = order.type === "food" ? foodStatusHistory : shopStatusHistory;

  return (
    <ClientLayout>
      <Card className={readResult.source === "mock" ? "border-warning/40 bg-warning/10" : undefined}>
        <CardContent className="p-4 text-sm font-medium">
          {readResult.source === "mock"
            ? "Demo cabinet. Детали заказа загружены из intentional mock mode."
            : "Детали заказа безопасно загружены для подтверждённого аккаунта клиента."}
        </CardContent>
      </Card>

      <Breadcrumb />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Badge className="w-fit" variant="info">Order detail</Badge>
                  <CardTitle className="mt-3 text-2xl">Детали заказа</CardTitle>
                  <CardDescription>{order.id}</CardDescription>
                </div>
                <OrderStatusBadge status={currentStatus} />
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <Info label="Тип заказа" value={order.type === "food" ? "Еда" : "Магазин"} />
              <Info label="Дата создания" value={new Date(order.createdAt).toLocaleString("ru-RU")} />
              <Info label="Статус оплаты" value={order.paymentStatus} />
              <Info label="Партнёр" value={order.partnerTitle ?? order.businessId} />
              <Info label="Business ID" value={order.businessId} />
              <Info label="Дата обновления" value={new Date(order.updatedAt).toLocaleString("ru-RU")} />
            </CardContent>
          </Card>

          <StatusHistory currentStatus={currentStatus} statuses={history} />

          <Card>
            <CardHeader>
              <CardTitle>Данные чтения</CardTitle>
              <CardDescription>Этот экран не изменяет заказ, оплату или статус.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-border bg-background p-4 text-sm text-muted">
                Источник: {readResult.source === "mock" ? "intentional mock mode" : "authenticated Supabase read"}.
              </div>
            </CardContent>
          </Card>
        </div>

        <SummaryCard order={order} />
      </section>
    </ClientLayout>
  );
}

function Breadcrumb() {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-2 p-4 text-sm font-medium text-muted">
        <a className="text-primary hover:opacity-80" href="/client">Кабинет</a>
        <span>/</span>
        <a className="text-primary hover:opacity-80" href="/client/orders">Мои заказы</a>
        <span>/</span>
        <span className="text-foreground">Заказ</span>
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

function StatusHistory({ currentStatus, statuses }: { currentStatus: ExtendedOrderStatus; statuses: ExtendedOrderStatus[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>История статусов</CardTitle>
        <CardDescription>Последовательность этапов заказа.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-3">
        {statuses.map((status) => (
          <div className="rounded-lg border border-border bg-background p-3" key={status}>
            <OrderStatusBadge status={status} />
            <p className="mt-2 text-xs text-muted">{status === currentStatus ? "Текущий статус" : "Этап заказа"}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SummaryCard({ order }: { order: ClientOrderReadItem }) {
  return (
    <Card className="h-fit xl:sticky xl:top-6">
      <CardHeader>
        <CardTitle>Итог заказа</CardTitle>
        <CardDescription>Суммы из безопасного read contour.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <SummaryRow label="Subtotal" value={`${order.subtotal} KGS`} />
        <SummaryRow label="Delivery" value={`${order.deliveryFee} KGS`} />
        <SummaryRow label="Discount" value={`${order.discount} KGS`} />
        <div className="border-t border-border pt-3">
          <SummaryRow label="Total" strong value={`${order.total} KGS`} />
        </div>
      </CardContent>
      <CardFooter>
        <a className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:border-primary hover:text-primary" href="/client/orders">
          Назад к заказам
        </a>
        <a className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:border-primary hover:text-primary" href="/client/support">
          Написать в поддержку
        </a>
      </CardFooter>
    </Card>
  );
}

function SummaryRow({ label, strong, value }: { label: string; strong?: boolean; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted">{label}</span>
      <span className={strong ? "text-lg font-semibold text-primary" : "font-semibold"}>{value}</span>
    </div>
  );
}

function NotFoundState({ readResult }: { readResult: ClientOrdersReadResult }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{readResult.ok ? "Заказ не найден" : "Заказ недоступен"}</CardTitle>
        <CardDescription>
          {readResult.ok
            ? "В доступных заказах клиента нет заказа с таким ID."
            : readResult.message ?? "Не удалось безопасно загрузить заказ."}
        </CardDescription>
      </CardHeader>
      <CardFooter>
        <a className="inline-flex min-h-11 items-center justify-center rounded-md border border-primary bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90" href="/client/orders">
          Вернуться к заказам
        </a>
      </CardFooter>
    </Card>
  );
}

function normalizeOrderStatus(status: string): ExtendedOrderStatus {
  switch (status) {
    case "new":
    case "accepted":
    case "preparing":
    case "assembling":
    case "ready":
    case "delivering":
    case "completed":
    case "rejected":
    case "cancelled":
    case "age_check":
    case "age_check_failed":
      return status;
    case "new_order":
      return "new";
    case "accepted_by_partner":
      return "accepted";
    case "ready_for_pickup":
      return "ready";
    case "courier_to_client":
    case "picked_up":
      return "delivering";
    case "delivered":
      return "completed";
    default:
      return "new";
  }
}
