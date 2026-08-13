import { CourierLayout } from "@/components/layout/CourierLayout";
import { CourierOperationalFinalPanel } from "@/app/courier/_components/CourierOperationalFinalPanel";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { getDeliveryOrders } from "@/lib/data/orders";

type HistoryStatus = "delivered" | "delivery_failed" | "cancelled";

const statusVariant: Record<HistoryStatus, BadgeVariant> = {
  delivered: "success",
  delivery_failed: "danger",
  cancelled: "muted"
};

const completedDeliveries = getDeliveryOrders().filter((order) => ["delivered", "cancelled"].includes(order.deliveryStatus ?? ""));
const problemDeliveries = completedDeliveries.filter((order) => order.deliveryStatus === "cancelled").length;

export default function CourierHistoryPage() {
  return (
    <CourierLayout status="online">
      <CourierOperationalFinalPanel context="history" />

      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-secondary via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">Courier history</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">История доставок</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
            Demo история завершённых доставок без реальной авторизации, смен и выплат.
          </p>
        </div>
      </Card>

      <Card className="border-warning/40 bg-warning/10">
        <CardContent className="p-4 text-sm font-medium text-foreground">
          Demo courier cabinet. Реальная история, GPS и подтверждения доставки будут подключены позже.
        </CardContent>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Завершено сегодня" value={completedDeliveries.length} />
        <StatCard label="Завершено за неделю" value={completedDeliveries.length + 8} />
        <StatCard label="Среднее время demo" value="34 мин" />
        <StatCard label="Проблемные доставки" value={problemDeliveries} />
      </section>

      <section className="grid gap-4">
        {completedDeliveries.map((order, index) => {
          const status = order.deliveryStatus === "delivered" ? "delivered" : "delivery_failed";
          const earning = status === "delivered" ? 180 + index * 25 : 0;

          return (
            <Card key={order.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>{order.type === "food" ? "Доставка еды" : "Доставка магазина"}</CardTitle>
                    <CardDescription>{order.id}</CardDescription>
                  </div>
                  <Badge variant={statusVariant[status]}>{status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-3">
                <Info label="Partner demo" value={order.businessId} />
                <Info label="Client demo" value={`Client demo ${order.clientUserId.replace("client-", "")}`} />
                <Info label="Route demo" value="Partner point → Client address" />
                <Info label="Total" value={`${order.total} ${order.currency}`} />
                <Info label="Courier earning demo" value={`${earning} KGS`} />
                <Info label="Completed time demo" value={new Date(order.createdAt).toLocaleString("ru-RU")} />
              </CardContent>
              <CardFooter>
                <Button variant="outline">Открыть детали demo</Button>
              </CardFooter>
            </Card>
          );
        })}
      </section>
    </CourierLayout>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <p className="text-sm font-medium text-muted">{label}</p>
        <p className="text-3xl font-semibold text-primary">{value}</p>
        <Badge variant="muted">history demo</Badge>
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
