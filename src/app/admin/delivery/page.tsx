import { redirect } from "next/navigation";
import { assignCourierAction } from "@/app/actions/admin/adminDeliveryReal";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { getAdminDeliveryReadResult } from "@/lib/data/admin-delivery-read";
import type { AdminCourierOption, AdminOperationalDeliveryOrder } from "@/lib/data/admin-delivery-operational-types";

const statusVariant: Record<string, BadgeVariant> = {
  delivery_pending: "warning", pending: "warning", new: "warning", preparing: "warning", ready_for_pickup: "info",
  courier_assigned: "info", assigned: "info", courier_accepted: "success", courier_to_partner: "warning",
  arrived_at_partner: "info", picked_up: "warning", courier_to_client: "warning", arrived_at_client: "info",
  delivering: "warning", delivered: "success", completed: "success", cancelled: "danger", delivery_failed: "danger", admin_required: "danger"
};
const assignableDeliveryStatuses = new Set(["delivery_pending"]);
type AdminDeliverySearchParams = { assignment?: string | string[]; assignmentCode?: string | string[]; deliveryId?: string | string[] };
function first(value?: string | string[]) { return Array.isArray(value) ? value[0] : value; }

async function assignCourierFromForm(formData: FormData) {
  "use server";
  const deliveryId = String(formData.get("deliveryId") ?? "");
  const courierId = String(formData.get("courierId") ?? "");
  const result = await assignCourierAction(deliveryId, courierId, "admin_ui_assignment");
  const params = new URLSearchParams({ assignment: result.ok ? "success" : "error", deliveryId: result.deliveryId ?? deliveryId });
  if (result.code) params.set("assignmentCode", result.code);
  redirect(`/admin/delivery?${params.toString()}`);
}

export default async function AdminDeliveryPage({ searchParams }: { searchParams?: Promise<AdminDeliverySearchParams> }) {
  const resolvedSearchParams = await searchParams;
  const readResult = await getAdminDeliveryReadResult();
  const deliveryOrders = readResult.orders;
  const couriers = readResult.couriers;
  const unavailable = !readResult.ok && readResult.code !== "empty_result";
  const operationalStatus = (order: AdminOperationalDeliveryOrder) => order.deliveryStatus ?? order.status;
  const unassigned = deliveryOrders.filter((order) => ["delivery_pending", "new", "preparing", "ready_for_pickup", "pending"].includes(operationalStatus(order))).length;
  const assigned = deliveryOrders.filter((order) => ["courier_assigned", "assigned"].includes(operationalStatus(order))).length;
  const inTransit = deliveryOrders.filter((order) => ["courier_accepted", "courier_to_partner", "arrived_at_partner", "picked_up", "courier_to_client", "arrived_at_client", "delivering"].includes(operationalStatus(order))).length;
  const problems = deliveryOrders.filter((order) => ["cancelled", "delivery_failed", "admin_required"].includes(operationalStatus(order))).length;
  const assignmentResult = first(resolvedSearchParams?.assignment);
  const assignmentCode = first(resolvedSearchParams?.assignmentCode);
  const assignmentDeliveryId = first(resolvedSearchParams?.deliveryId);

  return (
    <AdminLayout status={problems > 0 || unavailable ? "attention" : "stable"}>
      <Card className="overflow-hidden"><div className="bg-gradient-to-br from-slate-900 via-primary to-accent p-6 text-white"><Badge className="border-white/30 bg-white text-primary">KÖL Delivery Control</Badge><h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Контроль доставки</h2><p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">Администратор видит реальные заказы и состояние доставки, назначает доступного курьера через защищённую серверную операцию и контролирует дальнейший маршрут.</p></div></Card>

      {assignmentResult ? <Card className={assignmentResult === "success" ? "border-success/40 bg-success/10" : "border-danger/40 bg-danger/10"}><CardContent className="p-4 text-sm font-medium leading-6 text-foreground" role="status">{assignmentResult === "success" ? `Курьер назначен сервером${assignmentDeliveryId ? ` для доставки ${assignmentDeliveryId}` : ""}.` : `Назначение курьера отклонено безопасно${assignmentCode ? `: ${assignmentCode}` : "."}`}</CardContent></Card> : null}

      <Card className="border-primary/20 bg-lake-light"><CardHeader><CardTitle>Операционные действия защищены</CardTitle><CardDescription>Назначение курьера выполняется только для разрешённой роли через защищённый server action и атомарный Supabase RPC; интерфейс не изменяет delivery truth напрямую.</CardDescription></CardHeader></Card>

      <Card className={unavailable ? "border-danger/40 bg-danger/10" : "border-primary/20 bg-surface"}><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm"><Badge variant={readResult.source === "supabase" ? "success" : "warning"}>{readResult.source === "supabase" ? "Supabase · рабочие данные" : "Операции отключены"}</Badge><p className="max-w-3xl leading-6 text-muted">{unavailable ? "Рабочие данные доставки сейчас недоступны. Назначения не выполняются без подтверждённого Supabase-источника." : readResult.source === "supabase" ? `Получены реальные доставки и ${couriers.length} доступных курьеров.` : "Вне Supabase-режима экран доступен только для просмотра; реальные назначения не имитируются."}</p></CardContent></Card>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Без назначения" value={unavailable ? "—" : unassigned} tone="warning" /><StatCard label="Назначены" value={unavailable ? "—" : assigned} tone="info" /><StatCard label="В пути" value={unavailable ? "—" : inTransit} tone="warning" /><StatCard label="Требуют внимания" value={unavailable ? "—" : problems} tone={problems > 0 ? "danger" : "success"} /></section>

      <section className="grid gap-4">{deliveryOrders.map((order) => <DeliveryCard canAssignCourier={readResult.canAssignCourier} couriers={couriers} key={order.id} order={order} supabaseMode={readResult.source === "supabase"} />)}{!deliveryOrders.length ? <Card><CardContent className="p-5 text-sm text-muted">{unavailable ? "Данные доставки временно недоступны." : "Доставок в доступном контуре пока нет."}</CardContent></Card> : null}</section>
    </AdminLayout>
  );
}

function DeliveryCard({ canAssignCourier, couriers, order, supabaseMode }: { canAssignCourier: boolean; couriers: AdminCourierOption[]; order: AdminOperationalDeliveryOrder; supabaseMode: boolean }) {
  const currentStatus = order.deliveryStatus ?? order.status;
  const canAssign = canAssignCourier && Boolean(order.deliveryId) && assignableDeliveryStatuses.has(currentStatus) && couriers.length > 0 && supabaseMode;
  return (
    <Card>
      <CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>{order.id}</CardTitle><CardDescription>{order.partnerTitle ?? order.businessId}</CardDescription></div><Badge variant={statusVariant[currentStatus] ?? "muted"}>{currentStatus}</Badge></div></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><Info label="ID доставки" value={order.deliveryId ?? "Доставка ещё не создана"} /><Info label="Партнёр" value={order.businessId} /><Info label="Тип заказа" value={order.type} /><Info label="Статус оплаты" value={order.paymentStatus} /><Info label="Назначенный курьер" value={order.assignedCourierId ?? "Не назначен"} /><Info label="Сумма" value={`${order.total} KGS`} /><Info label="Обновлено" value={new Date(order.updatedAt).toLocaleString("ru-RU")} /></div>
        {canAssign ? <form action={assignCourierFromForm} className="grid gap-3 rounded-md border border-primary/20 bg-lake-light p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end"><input name="deliveryId" type="hidden" value={order.deliveryId} /><label className="grid gap-2 text-sm font-semibold text-foreground">Курьер<select aria-label={`Курьер для доставки ${order.deliveryId}`} className="min-h-11 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground" name="courierId" required><option value="">Выберите доступного курьера</option>{couriers.map((courier) => <option key={courier.userId} value={courier.userId}>{courier.fullName ?? courier.email ?? courier.userId} · online{courier.vehicleNumber ? ` · ${courier.vehicleNumber}` : ""}</option>)}</select></label><Button type="submit">Назначить курьера</Button></form> : null}
        {canAssignCourier && supabaseMode && order.deliveryId && assignableDeliveryStatuses.has(currentStatus) && couriers.length === 0 ? <p className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm font-medium text-foreground">Сейчас нет курьеров со статусом online. Назначение недоступно до появления реального доступного курьера.</p> : null}
      </CardContent>
    </Card>
  );
}
function StatCard({ label, tone, value }: { label: string; tone: BadgeVariant; value: string | number }) { return <Card><CardContent className="space-y-3 p-5"><p className="text-sm font-medium text-muted">{label}</p><p className="text-3xl font-semibold text-primary">{value}</p><Badge variant={tone}>Доставка</Badge></CardContent></Card>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-md border border-border bg-background p-3"><p className="text-xs font-medium text-muted">{label}</p><p className="mt-1 break-all font-semibold text-foreground">{value}</p></div>; }
