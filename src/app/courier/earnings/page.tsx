import { CourierLayout } from "@/components/layout/CourierLayout";
import { CourierOperationalFinalPanel } from "@/app/courier/_components/CourierOperationalFinalPanel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { getDeliveryOrders } from "@/lib/data/orders";

const completedDeliveries = getDeliveryOrders().filter((order) => order.deliveryStatus === "delivered").length;
const today = completedDeliveries * 220;
const week = today + 3600;
const month = week * 4;
const pending = Math.round(week * 0.45);

const breakdown = [
  { label: "base delivery fee demo", value: "180 KGS" },
  { label: "distance bonus demo", value: "40 KGS" },
  { label: "peak hour bonus demo", value: "60 KGS" },
  { label: "penalties demo", value: "0 KGS" }
];

const payouts = [
  { id: "payout-demo-001", date: "2026-06-18", amount: 1800, status: "paid" },
  { id: "payout-demo-002", date: "2026-06-19", amount: pending, status: "pending" }
];

export default function CourierEarningsPage() {
  return (
    <CourierLayout status="online">
      <CourierOperationalFinalPanel context="earnings" />

      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-secondary via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">Courier finance</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Доход курьера</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
            Demo финансовый обзор курьера. Расчёты условные и не создают выплат.
          </p>
        </div>
      </Card>

      <Card className="border-warning/40 bg-warning/10">
        <CardContent className="p-4 text-sm font-medium text-foreground">
          Real payouts and courier finance will be connected later.
        </CardContent>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Сегодня" value={`${today} KGS`} />
        <StatCard label="Неделя" value={`${week} KGS`} />
        <StatCard label="Месяц demo" value={`${month} KGS`} />
        <StatCard label="Ожидает выплаты" value={`${pending} KGS`} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Earning breakdown</CardTitle>
            <CardDescription>Demo structure for future courier finance.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {breakdown.map((item) => (
              <Info key={item.label} label={item.label} value={item.value} />
            ))}
          </CardContent>
          <CardFooter>
            <Button>Скачать отчёт demo</Button>
            <Button variant="outline">Запросить выплату demo</Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payout history demo</CardTitle>
            <CardDescription>Real payout status will require finance approval.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {payouts.map((payout) => (
              <div className="rounded-lg border border-border bg-background p-4" key={payout.id}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">{payout.id}</p>
                    <p className="text-sm text-muted">{payout.date}</p>
                  </div>
                  <Badge variant={payout.status === "paid" ? "success" : "warning"}>{payout.status}</Badge>
                </div>
                <p className="mt-3 text-xl font-semibold text-primary">{payout.amount} KGS</p>
              </div>
            ))}
          </CardContent>
        </Card>
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
        <Badge variant="muted">earnings demo</Badge>
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
