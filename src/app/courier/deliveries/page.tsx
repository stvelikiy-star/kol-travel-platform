import type { ReactNode } from "react";
import { CourierLayout } from "@/components/layout/CourierLayout";
import { CourierOperationalFinalPanel } from "@/app/courier/_components/CourierOperationalFinalPanel";
import { CourierIssueEscalationPanel } from "@/app/courier/_components/CourierIssueEscalationPanel";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
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

type RiskLevel = "low" | "medium" | "high";

const filters = ["All", "New", "Assigned", "Pickup", "On route", "Issues"];

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

const riskVariant: Record<RiskLevel, BadgeVariant> = {
  low: "success",
  medium: "warning",
  high: "danger"
};

export default async function CourierDeliveriesPage() {
  const readResult = await getCourierDeliveriesReadResult();
  const deliveryOrders = readResult.deliveries;
  const newDeliveries = deliveryOrders.filter((delivery) => ["pending", "delivery_pending", "new_order"].includes(delivery.status)).length;
  const assignedToMe = deliveryOrders.filter((delivery) => ["assigned", "courier_assigned"].includes(delivery.status)).length;
  const inTransit = deliveryOrders.filter((delivery) => ["picked_up", "delivering", "courier_to_client"].includes(delivery.status)).length;
  const problemDeliveries = deliveryOrders.filter((delivery) => ["cancelled", "delivery_failed", "issue_reported"].includes(delivery.status)).length;

  return (
    <CourierLayout status="online">
      <CourierOperationalFinalPanel context="deliveries" />
      <CourierIssueEscalationPanel context="deliveries" />

      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-secondary via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">Courier CRM</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Deliveries</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
            Demo list of available and assigned deliveries. Real assignment, route progress and issue writes are still disabled.
          </p>
        </div>
      </Card>

      <Card className="border-warning/40 bg-warning/10">
        <CardContent className="p-4 text-sm font-medium text-foreground">
          Demo courier cabinet. Courier controls stay demo-only here: no assignment, pickup, delivery completion, payment change or real issue write is performed.
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4 text-sm">
          <Badge variant={readResult.source === "supabase" ? "warning" : readResult.source === "fallback" ? "muted" : "info"}>
            {readResult.source === "supabase"
              ? "Supabase read pilot"
              : readResult.source === "fallback"
                ? "Fallback to mock data"
                : "Mock data mode"}
          </Badge>
          {readResult.code ? <Badge variant="muted">{readResult.code}</Badge> : null}
          <span className="text-muted">
            {readResult.message ?? "Courier deliveries are loaded through the read wrapper."}
          </span>
        </CardContent>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="New deliveries" value={newDeliveries} />
        <StatCard label="Assigned to me" value={assignedToMe} />
        <StatCard label="On route" value={inTransit} />
        <StatCard label="Issues" value={problemDeliveries} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>UI-only filters for future courier CRM.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {filters.map((filter, index) => (
            <Button key={filter} variant={index === 0 ? "primary" : "outline"}>
              {filter}
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card className="border-warning/40 bg-warning/10">
        <CardHeader>
          <CardTitle>Courier rules</CardTitle>
          <CardDescription>
            Courier read mode uses delivery-like data from public.orders when Supabase mode is enabled. Courier cannot change payment status,
            cancel order, mark delivered as a real write or enable alcohol delivery from this page.
          </CardDescription>
        </CardHeader>
      </Card>

      <section className="grid gap-4">
        {deliveryOrders.map((delivery, index) => {
          const status = mapDeliveryStatus(delivery.status);
          const risk = getRisk(index, status);

          return (
            <Card key={delivery.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>{delivery.type === "food" ? "Delivery food order" : "Delivery shop order"}</CardTitle>
                    <CardDescription>{delivery.orderId}</CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={statusVariant[status]}>{status}</Badge>
                    <Badge variant={riskVariant[risk]}>{risk} risk</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <Info label="Delivery/order id" value={delivery.orderId} />
                  <Info label="Business ID" value={delivery.businessId} />
                  <Info label="Partner title" value={delivery.partnerTitle ?? "Partner title unavailable"} />
                  <Info label="Type" value={delivery.type} />
                  <Info label="Status" value={delivery.status} />
                  <Info label="Payment status" value={delivery.paymentStatus} />
                  <Info label="Delivery fee" value={`${delivery.deliveryFee} KGS`} />
                  <Info label="Total" value={`${delivery.total} KGS`} />
                  <Info label="Updated at" value={delivery.updatedAt} />
                  <Info label="Pickup address demo" value="Cholpon-Ata partner pickup point" />
                  <Info label="Client address demo" value={`Client area ${index + 1}, Issyk-Kul`} />
                  <Info label="Client ID" value={delivery.clientId} />
                  <Info label="Estimated distance" value={`${3 + index * 2} km`} />
                  <Info label="Estimated time" value={`${18 + index * 7} min`} />
                  <Info label="Delivery status" value={status} />
                </div>
                <div className="rounded-lg border border-border bg-background p-4">
                  <p className="text-sm font-semibold text-foreground">Read-only delivery data</p>
                  <p className="mt-2 text-sm text-muted">
                    Source table for Supabase pilot: public.orders. Page load does not assign courier, change status, payment, total or audit logs.
                  </p>
                </div>
              </CardContent>
              <CardFooter>
                <Button>Accept delivery demo</Button>
                <ActionLink href={`/courier/deliveries/${delivery.orderId}`}>Open details demo</ActionLink>
                <ActionLink href="/courier/active" variant="outline">Open active demo</ActionLink>
                <ActionLink href="/courier/issues" variant="outline">Issue demo</ActionLink>
              </CardFooter>
            </Card>
          );
        })}
      </section>
    </CourierLayout>
  );
}

function mapDeliveryStatus(status: CourierDeliveryReadItem["status"] | undefined): CourierDeliveryStatus {
  if (status === "assigned") return "courier_assigned";
  if (status === "picked_up") return "picked_up";
  if (status === "delivered") return "delivered";
  if (status === "cancelled") return "delivery_failed";
  if (status === "delivering") return "courier_to_client";
  if (status === "courier_assigned") return "courier_assigned";
  if (status === "courier_accepted") return "courier_accepted";
  if (status === "courier_to_partner") return "courier_to_partner";
  if (status === "courier_to_client") return "courier_to_client";
  if (status === "delivery_failed") return "delivery_failed";
  return "delivery_pending";
}

function getRisk(index: number, status: CourierDeliveryStatus): RiskLevel {
  if (status === "delivery_failed") return "high";
  if (index % 2 === 1 || status === "delivery_pending") return "medium";
  return "low";
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <p className="text-sm font-medium text-muted">{label}</p>
        <p className="text-3xl font-semibold text-primary">{value}</p>
        <Badge variant="muted">deliveries demo</Badge>
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

function ActionLink({
  children,
  href,
  variant = "primary"
}: {
  children: ReactNode;
  href: string;
  variant?: "primary" | "outline";
}) {
  return (
    <a
      className={
        variant === "primary"
          ? "inline-flex min-h-11 items-center justify-center rounded-md border border-primary bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
          : "inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:border-primary hover:text-primary"
      }
      href={href}
    >
      {children}
    </a>
  );
}
