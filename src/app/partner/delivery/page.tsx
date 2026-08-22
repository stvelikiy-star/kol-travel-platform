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

  return (
    <PartnerLayout>
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-secondary via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">Delivery read-only</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Доставка партнёра</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
            Партнёр видит только delivery-состояние своих заказов через partner-scoped order reader. Управление курьерами, адреса клиента и контакты не подменяются demo-данными.
          </p>
        </div>
      </Card>

      <Card className={unavailable ? "border-danger/40 bg-danger/10" : "border-primary/20 bg-surface"}>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
          <div className="flex flex-wrap gap-2"><Badge variant={readResult.source === "supabase" ? "success" : "info"}>{readResult.source}</Badge>{readResult.code ? <Badge variant="muted">{readResult.code}</Badge> : null}</div>
          <p className="max-w-3xl leading-6 text-muted">{unavailable ? "Delivery overview unavailable. Generic delivery/orders fallback is disabled." : readResult.message ?? "Partner orders loaded through scoped reader."}</p>
        </CardContent>
      </Card>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Готовятся" value={unavailable ? "—" : preparing} />
        <StatCard label="Готовы к выдаче" value={unavailable ? "—" : readyForPickup} />
        <StatCard label="В доставке" value={unavailable ? "—" : inDelivery} />
      </section>

      <Card className="border-warning/40 bg-warning/10">
        <CardHeader><CardTitle>Delivery actions не выполняются здесь</CardTitle><CardDescription>Assign/reassign courier, issue escalation и client contact требуют отдельного assignment-aware backend и audit log.</CardDescription></CardHeader>
      </Card>

      <section className="grid gap-4">
        {orders.filter((order) => order.deliveryStatus || ["ready", "ready_for_pickup", "delivering"].includes(order.status)).map((order) => (
          <Card key={order.id}>
            <CardHeader><CardTitle>{order.type === "food" ? "Доставка еды" : "Доставка магазина"}</CardTitle><CardDescription>{order.id}</CardDescription></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Info label="Business" value={order.businessId} />
              <Info label="Preparation status" value={order.status} />
              <Info label="Delivery status" value={order.deliveryStatus ?? "not assigned"} />
              <Info label="Payment status" value={order.paymentStatus} />
              <Info label="Created" value={new Date(order.createdAt).toLocaleString("ru-RU")} />
            </CardContent>
          </Card>
        ))}
        {!orders.length ? <Card><CardContent className="p-5 text-sm text-muted">{unavailable ? "Partner delivery read unavailable." : "Заказов в доступном business scope пока нет."}</CardContent></Card> : null}
      </section>
    </PartnerLayout>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return <Card><CardContent className="space-y-3 p-5"><p className="text-sm font-medium text-muted">{label}</p><p className="text-3xl font-semibold text-primary">{value}</p><Badge variant="muted">scoped read</Badge></CardContent></Card>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-border bg-background p-3"><p className="text-xs text-muted">{label}</p><p className="break-all font-semibold text-foreground">{value}</p></div>;
}
