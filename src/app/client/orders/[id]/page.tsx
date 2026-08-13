import { ClientLayout } from "@/components/layout/ClientLayout";
import { OrderStatusBadge } from "@/components/status/OrderStatusBadge";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { getClientOrders, getOrderById } from "@/lib/data/orders";
import type { Order, OrderStatus } from "@/types";

type OrderDetailPageProps = {
  params: {
    id: string;
  };
};

const foodStatusHistory: OrderStatus[] = ["new", "accepted", "preparing", "ready", "delivering", "completed"];
const shopStatusHistory: OrderStatus[] = ["new", "accepted", "assembling", "ready", "delivering", "completed"];

export function generateStaticParams() {
  return getClientOrders().map((order) => ({ id: order.id }));
}

export default function ClientOrderDetailPage({ params }: OrderDetailPageProps) {
  const order = getOrderById(params.id);

  if (!order) {
    return (
      <ClientLayout>
        <NotFoundState />
      </ClientLayout>
    );
  }

  const history = order.type === "food" ? foodStatusHistory : shopStatusHistory;
  const discount = 0;
  const points = 0;

  return (
    <ClientLayout>
      <Card className="border-warning/40 bg-warning/10">
        <CardContent className="p-4 text-sm font-medium">Demo cabinet. Реальная авторизация и личные данные будут подключены позже.</CardContent>
      </Card>

      <Breadcrumb current="Заказ" parentHref="/client/orders" parentLabel="Мои заказы" />

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
                <OrderStatusBadge status={order.status} />
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <Info label="Тип заказа" value={order.type === "food" ? "Еда" : "Магазин"} />
              <Info label="Дата создания" value={new Date(order.createdAt).toLocaleString("ru-RU")} />
              <Info label="Сумма" value={`${order.total} ${order.currency}`} />
              <Info label="Способ оплаты" value={order.paymentStatus} />
              <Info label="Способ получения" value={order.deliveryStatus ?? "delivery demo"} />
              <Info label="Партнёр" value={order.businessId} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Позиции заказа</CardTitle>
              <CardDescription>Список позиций из demo order.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {order.items.map((item) => (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background p-4" key={item.id}>
                  <div>
                    <p className="font-semibold">{item.title}</p>
                    <p className="text-sm text-muted">{item.itemType} · {item.itemId}</p>
                  </div>
                  <p className="text-sm font-semibold">
                    {item.quantity} × {item.unitPrice} = {item.totalPrice} {order.currency}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <StatusHistory currentStatus={order.status} statuses={history} />

          <Card>
            <CardHeader>
              <CardTitle>Что дальше</CardTitle>
              <CardDescription>Demo-сценарий обработки заказа.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <NextStep title="Партнёр обрабатывает заказ" />
              <NextStep title="Клиент получит уведомление" />
              <NextStep title="После завершения начислятся баллы" />
            </CardContent>
          </Card>
        </div>

        <SummaryCard discount={discount} order={order} points={points} />
      </section>
    </ClientLayout>
  );
}

function Breadcrumb({ current, parentHref, parentLabel }: { current: string; parentHref: string; parentLabel: string }) {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-2 p-4 text-sm font-medium text-muted">
        <a className="text-primary hover:opacity-80" href="/client">Кабинет</a>
        <span>/</span>
        <a className="text-primary hover:opacity-80" href={parentHref}>{parentLabel}</a>
        <span>/</span>
        <span className="text-foreground">{current}</span>
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

function StatusHistory({ currentStatus, statuses }: { currentStatus: OrderStatus; statuses: OrderStatus[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>История статусов</CardTitle>
        <CardDescription>Demo timeline заказа.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-3">
        {statuses.map((status) => (
          <div className="rounded-lg border border-border bg-background p-3" key={status}>
            <OrderStatusBadge status={status} />
            <p className="mt-2 text-xs text-muted">{status === currentStatus ? "Текущий статус" : "Возможный этап"}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function NextStep({ title }: { title: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-4 text-sm font-semibold">
      {title}
    </div>
  );
}

function SummaryCard({ discount, order, points }: { discount: number; order: Order; points: number }) {
  return (
    <Card className="h-fit xl:sticky xl:top-6">
      <CardHeader>
        <CardTitle>Итог заказа</CardTitle>
        <CardDescription>Summary справа на desktop и снизу на mobile.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <SummaryRow label="Subtotal" value={`${order.subtotal} ${order.currency}`} />
        <SummaryRow label="Delivery" value={`${order.deliveryFee} ${order.currency}`} />
        <SummaryRow label="Discount" value={`${discount} ${order.currency}`} />
        <SummaryRow label="Points" value={`${points} ${order.currency}`} />
        <div className="border-t border-border pt-3">
          <SummaryRow label="Total" strong value={`${order.total} ${order.currency}`} />
        </div>
      </CardContent>
      <CardFooter>
        <a className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:border-primary hover:text-primary" href="/client/orders">
          Назад к заказам
        </a>
        <a className="inline-flex min-h-11 items-center justify-center rounded-md border border-primary bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90" href={order.type === "food" ? "/food" : "/shop"}>
          Повторить заказ
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

function NotFoundState() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Заказ не найден</CardTitle>
        <CardDescription>В demo data нет заказа с таким ID.</CardDescription>
      </CardHeader>
      <CardFooter>
        <a className="inline-flex min-h-11 items-center justify-center rounded-md border border-primary bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90" href="/client/orders">
          Вернуться к заказам
        </a>
      </CardFooter>
    </Card>
  );
}
