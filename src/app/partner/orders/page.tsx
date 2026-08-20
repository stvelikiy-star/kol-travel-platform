import { PartnerLayout } from "@/components/layout/PartnerLayout";
import { PartnerIssueEscalationPanel } from "@/app/partner/_components/PartnerIssueEscalationPanel";
import { markOrderReadyForPickupAction } from "@/app/actions/partner/partnerOrdersReal";
import { PartnerOrdersDemoActions } from "@/app/partner/orders/PartnerOrdersDemoActions";
import { PartnerOrderActions } from "@/components/partner/PartnerOrderActions";
import { PartnerWarningCard } from "@/components/partner/PartnerWarningCard";
import { DemoActionResultPanel } from "@/components/shared/DemoActionResultPanel";
import { OrderStatusBadge, orderStatusConfig } from "@/components/status/OrderStatusBadge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { getDataSourceMode, getSafeDataSourceLabel, isSupabaseMode } from "@/lib/data/data-source";
import { getPartnerOrdersReadResult } from "@/lib/data/partner-orders-read";
import type { Order } from "@/types";
import { redirect } from "next/navigation";

const filters = ["Все", "Новые", "Готовятся", "Готовы к выдаче", "Доставка", "Завершённые"];
const realReadyForPickupPilotOrderId = "50000000-0000-0000-0000-000000000001";

type PartnerOrdersSearchParams = {
  readyPickupPilot?: string | string[];
  readyPickupMessage?: string | string[];
  readyPickupCode?: string | string[];
  readyPickupAuditLogId?: string | string[];
};

const readyPickupSafeMessages: Record<string, string> = {
  invalid_order_id: "Test order id has an invalid format. Check the seeded pilot order id.",
  not_authenticated: "Authentication is required for the real action. Auth wiring is not active in this pilot.",
  not_authorized: "Current user is not allowed to run this real action.",
  profile_not_found: "Partner profile was not found for the seeded pilot user.",
  ownership_failed: "The test order does not belong to the seeded partner business.",
  order_not_found: "The seeded test order was not found in Supabase.",
  invalid_status_transition: "This order cannot be marked ready for pickup from its current status.",
  database_update_failed: "Order status could not be updated.",
  audit_insert_failed: "Order was updated, but audit log could not be created. Review the test database before continuing.",
  server_error: "The real pilot could not be completed safely.",
  real_pilot_disabled: "Real write pilot is disabled while DATA_SOURCE_MODE is mock."
};

function getSearchParamValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function createReadyForPickupPilotResult(searchParams?: PartnerOrdersSearchParams) {
  const status = getSearchParamValue(searchParams?.readyPickupPilot);

  if (!status) {
    return undefined;
  }

  const message = getSearchParamValue(searchParams?.readyPickupMessage);
  const code = getSearchParamValue(searchParams?.readyPickupCode);
  const auditLogId = getSearchParamValue(searchParams?.readyPickupAuditLogId);
  const safeMessage = code ? readyPickupSafeMessages[code] : undefined;

  return {
    ok: status === "success",
    mode: "real" as const,
    action: "mark_order_ready_for_pickup",
    message:
      safeMessage ??
      message ??
      (status === "blocked"
        ? "Real write pilot is disabled while DATA_SOURCE_MODE is mock."
        : "Real write pilot returned a safe result."),
    role: "partner" as const,
    riskLevel: "medium" as const,
    humanApprovalRequired: false,
    auditRequired: status !== "blocked",
    alcoholModuleEnabled: false as const,
    auditLogId,
    code
  };
}

async function runReadyForPickupRealPilot() {
  "use server";

  if (getDataSourceMode() !== "supabase") {
    redirect(
      "/partner/orders?readyPickupPilot=blocked&readyPickupCode=real_pilot_disabled&readyPickupMessage=Real%20write%20pilot%20is%20disabled%20while%20DATA_SOURCE_MODE%20is%20mock."
    );
  }

  const result = await markOrderReadyForPickupAction(realReadyForPickupPilotOrderId);
  const params = new URLSearchParams({
    readyPickupPilot: result.ok ? "success" : "error",
    readyPickupMessage: result.message
  });

  if (result.code) {
    params.set("readyPickupCode", result.code);
  }

  if (result.auditLogId) {
    params.set("readyPickupAuditLogId", result.auditLogId);
  }

  redirect(`/partner/orders?${params.toString()}`);
}

export default async function PartnerOrdersPage({ searchParams }: { searchParams?: Promise<PartnerOrdersSearchParams> }) {
  const resolvedSearchParams = await searchParams;
  const readResult = await getPartnerOrdersReadResult();
  const orders = readResult.orders;
  const realPilotEnabled = isSupabaseMode();
  const realPilotResult = createReadyForPickupPilotResult(resolvedSearchParams);
  const newOrders = orders.filter((order) => order.status === "new").length;
  const inProgressOrders = orders.filter((order) => ["accepted", "accepted_by_partner", "preparing", "assembling"].includes(order.status)).length;
  const readyOrders = orders.filter((order) => ["ready", "ready_for_pickup"].includes(order.status)).length;
  const waitingCourierOrders = orders.filter((order) => ["ready", "ready_for_pickup", "delivering"].includes(order.status)).length;

  return (
    <PartnerLayout>
      <PartnerIssueEscalationPanel context="orders" />

      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-secondary via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">Partner CRM</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Заказы партнёра</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
            Demo CRM заказов еды и магазина. Партнёр управляет подготовкой заказа и передачей в выдачу.
          </p>
        </div>
      </Card>

      <PartnerWarningCard
        description="Demo cabinet без авторизации. Реальные заказы, роли сотрудников и RLS будут подключены позже."
        title="Demo режим"
        tone="info"
      />

      <Card className="border-primary/15 bg-surface">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={realPilotEnabled ? "warning" : "info"}>
              {realPilotEnabled ? "Supabase read pilot" : "Mock data mode"}
            </Badge>
            {readResult.fallbackUsed ? <Badge variant="muted">Mock fallback</Badge> : null}
            {readResult.code ? <Badge variant="muted">{readResult.code}</Badge> : null}
          </div>
          <p className="text-sm leading-6 text-muted">
            {readResult.message ?? "Orders are loaded through the partner orders read wrapper."}
          </p>
        </CardContent>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Новые" value={newOrders} />
        <StatCard label="В работе" value={inProgressOrders} />
        <StatCard label="Готовы к выдаче" value={readyOrders} />
        <StatCard label="Ожидают курьера" value={waitingCourierOrders} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Фильтры</CardTitle>
          <CardDescription>UI-only tabs для будущей CRM фильтрации.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {filters.map((filter, index) => (
            <Button key={filter} variant={index === 0 ? "primary" : "outline"}>
              {filter}
            </Button>
          ))}
        </CardContent>
      </Card>

      <PartnerWarningCard
        description="Партнёр управляет подготовкой заказа. Доставку контролируют курьер, AI-диспетчер и админ KÖL."
        items={[
          "Партнёр принимает или отклоняет заказ",
          "Партнёр отмечает готовность к выдаче",
          "Курьерская доставка закрывается вне партнёрского кабинета",
          "Статус оплаты не меняется demo-действиями"
        ]}
        title="Важное про доставку"
        tone="warning"
      />

      <PartnerOrdersDemoActions />

      <Card className="border-warning/20 bg-warning/5">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="warning">Real write pilot</Badge>
            <Badge variant="muted">{getSafeDataSourceLabel()}</Badge>
          </div>
          <CardTitle>Готов к выдаче — controlled test</CardTitle>
          <CardDescription>
            This pilot targets only the seeded test order. Demo buttons stay available, and no real write runs while DATA_SOURCE_MODE is mock.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={runReadyForPickupRealPilot} className="flex flex-wrap items-center gap-3">
            <Button disabled={!realPilotEnabled} type="submit" variant="secondary">
              Готов к выдаче — real test
            </Button>
            <p className="break-words text-xs leading-5 text-muted">
              Test order: <span className="font-semibold text-foreground">{realReadyForPickupPilotOrderId}</span>
            </p>
          </form>
          <p className="rounded-lg border border-border bg-background/70 p-3 text-sm leading-6 text-muted">
            {realPilotEnabled
              ? "Supabase mode is enabled for this pilot. The action must not change payments, order items, courier state or alcohol settings."
              : "Mock mode is active. The real test button is disabled; use the existing demo controls for local UI checks."}
          </p>
          <DemoActionResultPanel result={realPilotResult} title="Ready for pickup pilot result" />
        </CardContent>
      </Card>

      <section className="grid gap-4">
        {orders.map((order, index) => (
          <Card key={order.id}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>{order.type === "food" ? "Заказ еды" : "Заказ магазина"}</CardTitle>
                  <CardDescription>
                    {order.id} · Client demo {index + 1}
                  </CardDescription>
                </div>
                <SafeOrderStatusBadge status={order.status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                <Info label="id" value={order.id} />
                <Info label="business_id" value={order.businessId} />
                <Info label="type" value={order.type} />
                <Info label="status" value={order.status} />
                <Info label="payment_status" value={order.paymentStatus} />
                <Info label="total" value={`${order.total} ${order.currency}`} />
                <Info label="Тип" value={order.type} />
                <Info label="Сумма" value={`${order.total} ${order.currency}`} />
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <Info label="Дата создания" value={new Date(order.createdAt).toLocaleString("ru-RU")} />
                <Info label="updated_at" value={getOrderUpdatedAt(order)} />
                <Info label="Delivery status demo" value={order.deliveryStatus ?? "not assigned"} />
              </div>
              <div className="rounded-lg border border-border bg-background p-4">
                <p className="text-sm font-semibold text-foreground">Позиции</p>
                <div className="mt-3 grid gap-2">
                  {order.items.map((item) => (
                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm" key={item.id}>
                      <span className="text-foreground">{item.title}</span>
                      <span className="text-muted">
                        {item.quantity} × {item.unitPrice} = {item.totalPrice} {order.currency}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
            <CardContent className="pt-0">
              <PartnerOrderActions compact detailHref={`/partner/orders/${order.id}`} />
            </CardContent>
          </Card>
        ))}
      </section>
    </PartnerLayout>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <p className="text-sm font-medium text-muted">{label}</p>
        <p className="text-3xl font-semibold text-primary">{value}</p>
        <Badge variant="muted">orders demo</Badge>
      </CardContent>
    </Card>
  );
}

function SafeOrderStatusBadge({ status }: { status: string }) {
  if (status in orderStatusConfig) {
    return <OrderStatusBadge status={status as keyof typeof orderStatusConfig} />;
  }

  return <Badge variant="warning">{status}</Badge>;
}

function getOrderUpdatedAt(order: Order) {
  const updatedAt = (order as Order & { updatedAt?: string }).updatedAt;
  const value = updatedAt ?? order.createdAt;

  return new Date(value).toLocaleString("ru-RU");
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="font-semibold text-foreground">{value}</p>
    </div>
  );
}
