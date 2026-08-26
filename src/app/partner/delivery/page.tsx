import { PartnerLayout } from "@/components/layout/PartnerLayout";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { getPartnerOrdersReadResult } from "@/lib/data/partner-orders-read";

export default async function PartnerDeliveryPage() {
  const readResult = await getPartnerOrdersReadResult();
  const orders = readResult.orders;
  const unavailable = !readResult.ok && readResult.code !== "empty_result";
  const preparing = orders.filter((order) => ["accepted", "accepted_by_partner", "preparing", "assembling"].includes(order.status)).length;
  const readyForPickup = orders.filter((order) => ["ready", "ready_for_pickup"].includes(order.status)).length;
  const inDelivery = orders.filter((order) => ["assigned", "picked_up", "delivering", "courier_to_client"].includes(order.deliveryStatus ?? "")).length;
  const sourceLabel = readResult.source === "supabase" ? "Мои заказы" : "Безопасное демо";

  return (
    <PartnerLayout>
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-secondary via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">KÖL Partner Delivery</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Доставка партнёра</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
            Партнёр видит только доставку собственных заказов: подготовку, готовность к выдаче и движение заказа к клиенту. Управление курьерами и контактные данные не подменяются вымышленными значениями.
          </p>
        </div>
      </Card>

      <Card className={unavailable ? "border-danger/40 bg-danger/10" : "border-primary/20 bg-surface"}>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
          <Badge variant={readResult.source === "supabase" ? "success" : "info"}>{sourceLabel}</Badge>
          <p className="max-w-3xl leading-6 text-muted">{unavailable ? "Данные доставки сейчас недоступны; KÖL не показывает чужие заказы вместо них." : readResult.source === "supabase" ? "Загружены заказы текущего партнёра." : "Демо показывает рабочий интерфейс без изменения production-данных."}</p>
        </CardContent>
      </Card>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Готовятся" value={unavailable ? "—" : preparing} />
        <StatCard label="Готовы к выдаче" value={unavailable ? "—" : readyForPickup} />
        <StatCard label="В доставке" value={unavailable ? "—" : inDelivery} />
      </section>

      <Card className="border-primary/20 bg-lake-light">
        <CardHeader><CardTitle>Действия с доставкой защищены</CardTitle><CardDescription>Назначение курьера, переназначение, эскалация проблемы и раскрытие контактов требуют отдельного разрешённого серверного процесса и проверки прав.</CardDescription></CardHeader>
      </Card>

      <section className="grid gap-4">
        {orders.filter((order) => order.deliveryStatus || ["ready", "ready_for_pickup", "delivering"].includes(order.status)).map((order) => (
          <Card key={order.id}>
            <CardHeader><CardTitle>{order.type === "food" ? "Доставка еды" : "Доставка магазина"}</CardTitle><CardDescription>{order.id}</CardDescription></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Info label="ID партнёра" value={order.businessId} />
              <Info label="Подготовка" value={order.status} />
              <Info label="Доставка" value={order.deliveryStatus ?? "Не назначена"} />
              <Info label="Оплата" value={order.paymentStatus} />
              <Info label="Создан" value={new Date(order.createdAt).toLocaleString("ru-RU")} />
            </CardContent>
          </Card>
        ))}
        {!orders.length ? <Card><CardContent className="p-5 text-sm text-muted">{unavailable ? "Данные доставки временно недоступны." : "Заказов для доставки пока нет."}</CardContent></Card> : null}
      </section>
    </PartnerLayout>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return <Card><CardContent className="space-y-3 p-5"><p className="text-sm font-medium text-muted">{label}</p><p className="text-3xl font-semibold text-primary">{value}</p><Badge variant="muted">Доставка</Badge></CardContent></Card>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-border bg-background p-3"><p className="text-xs text-muted">{label}</p><p className="break-all font-semibold text-foreground">{value}</p></div>;
}
