import type { ReactNode } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { getAdminBookings, getAdminOrders } from "@/lib/data/admin";

const adminOrders = getAdminOrders();
const adminBookings = getAdminBookings();
const orderGmv = adminOrders.reduce((sum, order) => sum + order.total, 0);
const bookingGmv = adminBookings.reduce((sum, booking) => sum + booking.total, 0);
const gmv = orderGmv + bookingGmv;
const platformCommission = Math.round(gmv * 0.12);
const partnerPayouts = Math.round(gmv * 0.78);
const courierPayouts = adminOrders.reduce((sum, order) => sum + Math.round(order.deliveryFee * 0.7), 0);
const refunds = adminOrders
  .filter((order) => ["cancelled", "refunded"].includes(order.paymentStatus))
  .reduce((sum, order) => sum + order.total, 0) + adminBookings
  .filter((booking) => booking.paymentStatus === "refunded")
  .reduce((sum, booking) => sum + booking.total, 0);

const partnerPayoutRows = [
  { partner: "business-restaurant-naryn", amount: 1280, status: "pending" },
  { partner: "business-shop-sary-oi", amount: 1710, status: "ready" },
  { partner: "business-hotel-aurora", amount: 9672, status: "paid_demo" },
  { partner: "business-tour-karakol", amount: 0, status: "dispute" }
];

const courierPayoutRows = [
  { courier: "Courier A demo", amount: 420, status: "ready" },
  { courier: "Courier B demo", amount: 330, status: "pending" },
  { courier: "Courier C demo", amount: 210, status: "paid_demo" }
];

const commissionRows = [
  { source: "Orders commission demo", amount: Math.round(orderGmv * 0.12), rate: "12%" },
  { source: "Bookings commission demo", amount: Math.round(bookingGmv * 0.12), rate: "12%" },
  { source: "Delivery service demo", amount: Math.round(courierPayouts * 0.2), rate: "demo" }
];

const transactionRows = [
  ...adminOrders.map((order) => ({
    id: order.id,
    type: `order:${order.type}`,
    amount: order.total,
    status: order.paymentStatus,
    date: order.createdAt
  })),
  ...adminBookings.map((booking) => ({
    id: booking.id,
    type: `booking:${booking.type}`,
    amount: booking.total,
    status: booking.paymentStatus,
    date: booking.createdAt
  }))
];

export default function AdminFinancePage() {
  return (
    <AdminLayout status="attention">
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-slate-900 via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">Finance demo</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Финансы платформы</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
            Demo financial control для GMV, комиссий, выплат партнёрам, выплат курьерам, возвратов и спорных операций.
          </p>
        </div>
      </Card>

      <Card className="border-warning/40 bg-warning/10">
        <CardContent className="p-4 text-sm font-medium text-foreground">
          Finance demo. Реальные платежи, выплаты, комиссии, audit log и бухгалтерские документы будут подключены позже.
        </CardContent>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="GMV demo" value={formatMoney(gmv)} tone="info" />
        <StatCard label="Комиссия KÖL demo" value={formatMoney(platformCommission)} tone="success" />
        <StatCard label="К выплате партнёрам" value={formatMoney(partnerPayouts)} tone="warning" />
        <StatCard label="К выплате курьерам" value={formatMoney(courierPayouts)} tone="info" />
        <StatCard label="Возвраты demo" value={formatMoney(refunds)} tone="danger" />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <FinanceList
          title="Partner payouts demo"
          description="Сводка будущих выплат партнёрам."
          rows={partnerPayoutRows.map((row) => ({
            title: row.partner,
            amount: formatMoney(row.amount),
            meta: "partner payout",
            status: row.status
          }))}
        />
        <FinanceList
          title="Courier payouts demo"
          description="Сводка будущих выплат курьерам."
          rows={courierPayoutRows.map((row) => ({
            title: row.courier,
            amount: formatMoney(row.amount),
            meta: "courier payout",
            status: row.status
          }))}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <FinanceList
            title="Platform commission demo"
            description="Расчёт комиссии KÖL только для UI demo."
            rows={commissionRows.map((row) => ({
              title: row.source,
              amount: formatMoney(row.amount),
              meta: `rate ${row.rate}`,
              status: "commission"
            }))}
          />

          <Card>
            <CardHeader>
              <CardTitle>Transaction list demo</CardTitle>
              <CardDescription>Заказы и брони из mock data как будущая finance ledger.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {transactionRows.map((transaction) => (
                <div className="rounded-lg border border-border bg-background p-4" key={transaction.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">{transaction.id}</p>
                      <p className="text-sm text-muted">{transaction.type} · {transaction.date}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={paymentTone(transaction.status)}>{transaction.status}</Badge>
                      <Badge variant="muted">{formatMoney(transaction.amount)}</Badge>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
            <CardFooter>
              <Button>Скачать отчёт demo</Button>
              <Button variant="outline">Экспорт ledger demo</Button>
            </CardFooter>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card className="border-danger/30 bg-danger/10">
            <CardHeader>
              <CardTitle>Refunds / disputes demo</CardTitle>
              <CardDescription>Возвраты и спорные операции требуют ручной проверки.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Info label="Refund amount demo" value={formatMoney(refunds)} />
              <Info label="Open disputes demo" value="2" />
              <Info label="Audit required" value="yes, later" />
            </CardContent>
            <CardFooter>
              <Button variant="danger">Открыть спор demo</Button>
            </CardFooter>
          </Card>

          <Card className="border-warning/40 bg-warning/10">
            <CardHeader>
              <CardTitle>Finance rules</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <Rule>AI never changes payment status.</Rule>
              <Rule>Finance changes require human admin approval.</Rule>
              <Rule>Refunds require audit log later.</Rule>
              <Rule>Alcohol module remains OFF.</Rule>
            </CardContent>
          </Card>
        </aside>
      </div>
    </AdminLayout>
  );
}

function FinanceList({
  description,
  rows,
  title
}: {
  description: string;
  rows: Array<{ amount: string; meta: string; status: string; title: string }>;
  title: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {rows.map((row) => (
          <div className="rounded-lg border border-border bg-background p-4" key={`${row.title}-${row.status}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-foreground">{row.title}</p>
                <p className="text-sm text-muted">{row.meta}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant={financeTone(row.status)}>{row.status}</Badge>
                <Badge variant="muted">{row.amount}</Badge>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function StatCard({ label, tone, value }: { label: string; tone: BadgeVariant; value: string | number }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <p className="text-sm font-medium text-muted">{label}</p>
        <p className="text-3xl font-semibold text-primary">{value}</p>
        <Badge variant={tone}>finance demo</Badge>
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 font-semibold text-foreground">{value}</p>
    </div>
  );
}

function Rule({ children }: { children: ReactNode }) {
  return <div className="rounded-md border border-warning/30 bg-surface p-3 text-sm font-medium text-foreground">{children}</div>;
}

function formatMoney(value: number) {
  return `${value.toLocaleString("ru-RU")} KGS`;
}

function financeTone(status: string): BadgeVariant {
  if (["paid_demo", "ready", "commission"].includes(status)) return "success";
  if (["pending"].includes(status)) return "warning";
  if (["dispute"].includes(status)) return "danger";
  return "muted";
}

function paymentTone(status: string): BadgeVariant {
  if (status === "paid") return "success";
  if (status === "pending") return "warning";
  if (["cancelled", "failed", "refunded"].includes(status)) return "danger";
  return "muted";
}
