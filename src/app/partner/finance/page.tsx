import { PartnerLayout } from "@/components/layout/PartnerLayout";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/Card";
import { getPartnerBookings } from "@/lib/data/bookings";
import { getPartnerOrders } from "@/lib/data/orders";

const partnerOrders = getPartnerOrders();
const partnerBookings = getPartnerBookings();
const orderRevenue = partnerOrders.reduce((sum, order) => sum + order.total, 0);
const bookingRevenue = partnerBookings.reduce((sum, booking) => sum + booking.total, 0);
const revenue = orderRevenue + bookingRevenue;
const commission = Math.round(revenue * 0.12);
const payoutDue = revenue - commission;
const paidOut = Math.round(payoutDue * 0.45);

const transactions = [
  ...partnerOrders.slice(0, 3).map((order) => ({
    id: order.id,
    type: order.type === "food" ? "Заказ еды" : "Заказ магазина",
    amount: order.total,
    status: order.paymentStatus,
    date: order.createdAt
  })),
  ...partnerBookings.slice(0, 2).map((booking) => ({
    id: booking.id,
    type: booking.type === "tour" ? "Бронь тура" : "Бронь жилья",
    amount: booking.total,
    status: booking.paymentStatus,
    date: booking.createdAt
  }))
];

export default function PartnerFinancePage() {
  return (
    <PartnerLayout>
      <section className="space-y-6">
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-5">
          <Badge variant="warning">Demo finance</Badge>
          <h2 className="mt-3 text-2xl font-semibold text-foreground">Финансы</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            Real payments, payouts and commissions will be connected later.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Выручка demo" value={formatMoney(revenue)} />
          <StatCard label="Комиссия KÖL demo" value={formatMoney(commission)} />
          <StatCard label="К выплате" value={formatMoney(payoutDue - paidOut)} />
          <StatCard label="Выплачено" value={formatMoney(paidOut)} />
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Card>
            <CardHeader>
              <CardTitle>Транзакции demo</CardTitle>
              <CardDescription>Сводка по заказам и броням из mock data.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {transactions.map((transaction) => (
                <div
                  className="grid gap-3 rounded-lg border border-border bg-background p-4 md:grid-cols-[1fr_auto_auto]"
                  key={transaction.id}
                >
                  <div>
                    <p className="font-semibold text-foreground">{transaction.type}</p>
                    <p className="text-sm text-muted">
                      {transaction.id} · {transaction.date}
                    </p>
                  </div>
                  <Badge variant="info">{transaction.status}</Badge>
                  <p className="text-lg font-semibold text-primary">{formatMoney(transaction.amount)}</p>
                </div>
              ))}
            </CardContent>
            <CardFooter>
              <Button>Скачать отчёт demo</Button>
              <Button variant="outline">Запросить выплату demo</Button>
            </CardFooter>
          </Card>

          <div className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle>Выплаты</CardTitle>
                <CardDescription>Пока без реальных банковских операций.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Payout label="Следующая выплата" amount={payoutDue - paidOut} status="pending" />
                <Payout label="Последняя выплата" amount={paidOut} status="paid" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Комиссия платформы</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-6 text-muted">
                <p>
                  В demo используется условная комиссия 12%. Реальные ставки будут зависеть
                  от типа партнёра, договора, категории и способа оплаты.
                </p>
                <Badge variant="muted">manual/cash/transfer MVP</Badge>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </PartnerLayout>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-muted">{label}</p>
        <p className="mt-3 text-2xl font-semibold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

function Payout({ label, amount, status }: { label: string; amount: number; status: "pending" | "paid" }) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold text-foreground">{label}</p>
        <Badge variant={status === "paid" ? "success" : "warning"}>{status}</Badge>
      </div>
      <p className="mt-3 text-2xl font-semibold text-primary">{formatMoney(amount)}</p>
    </div>
  );
}

function formatMoney(value: number) {
  return `${value.toLocaleString("ru-RU")} KGS`;
}
