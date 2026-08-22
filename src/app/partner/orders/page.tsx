import { PartnerLayout } from "@/components/layout/PartnerLayout";
import { markOrderReadyForPickupAction } from "@/app/actions/partner/partnerOrdersReal";
import { DemoActionResultPanel } from "@/components/shared/DemoActionResultPanel";
import { OrderStatusBadge, orderStatusConfig } from "@/components/status/OrderStatusBadge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { getDataSourceMode, getSafeDataSourceLabel, isSupabaseMode } from "@/lib/data/data-source";
import { getPartnerOrdersReadResult } from "@/lib/data/partner-orders-read";
import type { Order } from "@/types";
import { redirect } from "next/navigation";

const realReadyForPickupPilotOrderId = "50000000-0000-0000-0000-000000000001";

type PartnerOrdersSearchParams = {
  readyPickupPilot?: string | string[];
  readyPickupMessage?: string | string[];
  readyPickupCode?: string | string[];
  readyPickupAuditLogId?: string | string[];
};

const readyPickupSafeMessages: Record<string, string> = {
  invalid_order_id: "Test order id has an invalid format.",
  not_authenticated: "Authentication is required for the real action.",
  not_authorized: "Current user is not allowed to run this action.",
  profile_not_found: "Partner profile was not found.",
  ownership_failed: "The test order does not belong to the authenticated partner business.",
  order_not_found: "The seeded test order was not found.",
  invalid_status_transition: "This order cannot be marked ready for pickup from its current status.",
  database_update_failed: "Order status could not be updated.",
  audit_insert_failed: "Order changed but audit log creation failed. Review the test database.",
  server_error: "The controlled test could not be completed safely.",
  real_pilot_disabled: "Real write pilot is disabled outside Supabase mode."
};

function first(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function createReadyForPickupPilotResult(searchParams?: PartnerOrdersSearchParams) {
  const status = first(searchParams?.readyPickupPilot);
  if (!status) return undefined;
  const code = first(searchParams?.readyPickupCode);
  return {
    ok: status === "success",
    mode: "real" as const,
    action: "mark_order_ready_for_pickup",
    message: (code && readyPickupSafeMessages[code]) ?? first(searchParams?.readyPickupMessage) ?? "Controlled test returned a safe result.",
    role: "partner" as const,
    riskLevel: "medium" as const,
    humanApprovalRequired: false,
    auditRequired: status !== "blocked",
    alcoholModuleEnabled: false as const,
    auditLogId: first(searchParams?.readyPickupAuditLogId),
    code
  };
}

async function runReadyForPickupRealPilot() {
  "use server";
  if (getDataSourceMode() !== "supabase") {
    redirect("/partner/orders?readyPickupPilot=blocked&readyPickupCode=real_pilot_disabled");
  }
  const result = await markOrderReadyForPickupAction(realReadyForPickupPilotOrderId);
  const params = new URLSearchParams({
    readyPickupPilot: result.ok ? "success" : "error",
    readyPickupMessage: result.message
  });
  if (result.code) params.set("readyPickupCode", result.code);
  if (result.auditLogId) params.set("readyPickupAuditLogId", result.auditLogId);
  redirect(`/partner/orders?${params.toString()}`);
}

export default async function PartnerOrdersPage({ searchParams }: { searchParams?: Promise<PartnerOrdersSearchParams> }) {
  const resolvedSearchParams = await searchParams;
  const readResult = await getPartnerOrdersReadResult();
  const orders = readResult.orders;
  const unavailable = !readResult.ok && readResult.code !== "empty_result";
  const realPilotEnabled = isSupabaseMode();
  const realPilotResult = createReadyForPickupPilotResult(resolvedSearchParams);
  const newOrders = orders.filter((order) => order.status === "new").length;
  const inProgressOrders = orders.filter((order) => ["accepted", "accepted_by_partner", "preparing", "assembling"].includes(order.status)).length;
  const readyOrders = orders.filter((order) => ["ready", "ready_for_pickup"].includes(order.status)).length;

  return (
    <PartnerLayout>
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-secondary via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">Partner orders</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Заказы партнёра</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
            Заказы читаются только через partner-scoped read wrapper. Чужие бизнесы, придуманные клиенты и неподтверждённые контакты не отображаются.
          </p>
        </div>
      </Card>

      <Card className={unavailable ? "border-danger/40 bg-danger/10" : "border-primary/20 bg-surface"}>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
          <div className="flex flex-wrap gap-2">
            <Badge variant={readResult.source === "supabase" ? "success" : "info"}>{readResult.source}</Badge>
            {readResult.code ? <Badge variant="muted">{readResult.code}</Badge> : null}
          </div>
          <p className="max-w-3xl leading-6 text-muted">
            {unavailable ? "Заказы сейчас недоступны. Общий orders-каталог не используется как fallback." : readResult.message ?? "Partner orders loaded through scoped reader."}
          </p>
        </CardContent>
      </Card>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Новые" value={unavailable ? "—" : newOrders} />
        <StatCard label="В работе" value={unavailable ? "—" : inProgressOrders} />
        <StatCard label="Готовы к выдаче" value={unavailable ? "—" : readyOrders} />
      </section>

      {realPilotEnabled ? (
        <Card className="border-warning/30 bg-warning/5">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2"><Badge variant="warning">Controlled test only</Badge><Badge variant="muted">{getSafeDataSourceLabel()}</Badge></div>
            <CardTitle>Готов к выдаче — seeded test order</CardTitle>
            <CardDescription>Server action validates authentication, partner ownership and allowed status transition. It does not alter payments, items or courier state.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action={runReadyForPickupRealPilot} className="flex flex-wrap items-center gap-3">
              <Button type="submit" variant="secondary">Запустить controlled test</Button>
              <p className="break-all text-xs text-muted">{realReadyForPickupPilotOrderId}</p>
            </form>
            <DemoActionResultPanel result={realPilotResult} title="Controlled test result" />
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-4">
        {orders.map((order) => (
          <Card key={order.id}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><CardTitle>{order.type === "food" ? "Заказ еды" : "Заказ магазина"}</CardTitle><CardDescription>{order.id}</CardDescription></div>
                <SafeOrderStatusBadge status={order.status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Info label="Business" value={order.businessId} />
                <Info label="Type" value={order.type} />
                <Info label="Payment status" value={order.paymentStatus} />
                <Info label="Total" value={`${order.total} ${order.currency}`} />
                <Info label="Created" value={new Date(order.createdAt).toLocaleString("ru-RU")} />
                <Info label="Updated" value={getOrderUpdatedAt(order)} />
                <Info label="Delivery status" value={order.deliveryStatus ?? "not assigned"} />
              </div>
              <div className="rounded-lg border border-border bg-background p-4">
                <p className="text-sm font-semibold text-foreground">Позиции</p>
                <div className="mt-3 grid gap-2">
                  {order.items.map((item) => (
                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm" key={item.id}>
                      <span className="text-foreground">{item.title}</span>
                      <span className="text-muted">{item.quantity} × {item.unitPrice} = {item.totalPrice} {order.currency}</span>
                    </div>
                  ))}
                </div>
              </div>
              <a className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary" href={`/partner/orders/${order.id}`}>Открыть детали</a>
            </CardContent>
          </Card>
        ))}
        {!orders.length ? <Card><CardContent className="p-5 text-sm text-muted">{unavailable ? "Orders read unavailable." : "Заказов в доступном business scope пока нет."}</CardContent></Card> : null}
      </section>
    </PartnerLayout>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return <Card><CardContent className="space-y-3 p-5"><p className="text-sm font-medium text-muted">{label}</p><p className="text-3xl font-semibold text-primary">{value}</p><Badge variant="muted">scoped read</Badge></CardContent></Card>;
}

function SafeOrderStatusBadge({ status }: { status: string }) {
  if (status in orderStatusConfig) return <OrderStatusBadge status={status as keyof typeof orderStatusConfig} />;
  return <Badge variant="warning">{status}</Badge>;
}

function getOrderUpdatedAt(order: Order) {
  const value = (order as Order & { updatedAt?: string }).updatedAt ?? order.createdAt;
  return new Date(value).toLocaleString("ru-RU");
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-border bg-background p-3"><p className="text-xs text-muted">{label}</p><p className="break-all font-semibold text-foreground">{value}</p></div>;
}
