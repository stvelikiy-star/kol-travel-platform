import { PublicFooter } from "@/components/layout/PublicFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { mockOrders } from "@/data/mockOrders";

const order = mockOrders[0];
const nextSteps = [
  "заказ будет отправлен партнёру",
  "партнёр примет или отклонит заказ",
  "клиент получит уведомление",
  "после завершения начислятся баллы"
];

export default function OrderSuccessPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <Container className="space-y-8 py-10">
        <section className="rounded-lg border border-border/80 bg-gradient-to-br from-lake-light via-surface to-sand-light p-6 shadow-soft">
          <SectionTitle
            description="Реальное создание заказа, оплата и уведомления будут подключены на следующих этапах."
            eyebrow="Success demo"
            title="Заказ создан в demo mode"
          />
        </section>

        <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle>Demo order</CardTitle>
              <CardDescription>Данные взяты из mockOrders.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <Info label="Order ID" value={order.id} />
                <Info label="Тип заказа" value={order.type === "food" ? "еда" : "магазин"} />
                <Info label="Статус" value={order.status} />
                <Info label="Сумма" value={`${order.total} ${order.currency}`} />
                <Info label="Способ оплаты" value={order.paymentStatus} />
                <Info label="Способ получения" value={order.deliveryStatus ?? "pickup/manual"} />
                <Info label="Дата создания" value={order.createdAt} />
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold">Позиции</p>
                {order.items.map((item) => (
                  <div className="rounded-md border border-border/80 bg-background p-3 text-sm" key={item.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{item.title}</p>
                        <p className="text-muted">
                          {item.quantity} × {item.unitPrice} KGS
                        </p>
                      </div>
                      <Badge>{item.totalPrice} KGS</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>What happens next</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {nextSteps.map((step, index) => (
                <div className="flex gap-3 rounded-md border border-border/80 bg-background p-3 text-sm" key={step}>
                  <Badge>{index + 1}</Badge>
                  <p className="font-medium">{step}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="border-warning/40 bg-warning/10">
          <CardContent className="p-5 text-sm font-medium leading-6 text-foreground">
            Это demo page. Реальная CRM партнёра, Telegram/n8n уведомления и платежи будут
            подключены позже.
          </CardContent>
        </Card>

        <section className="flex flex-wrap gap-3">
          <NavButton href="/" label="На главную" />
          <NavButton href="/cart" label="В корзину" />
          <NavButton href="/food" label="Смотреть еду" />
          <NavButton href="/shop" label="Смотреть магазин" />
        </section>
      </Container>
      <PublicFooter />
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-background p-3 text-sm">
      <p className="text-muted">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function NavButton({ href, label }: { href: string; label: string }) {
  return (
    <a
      className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:border-primary hover:bg-lake-light hover:text-primary"
      href={href}
    >
      {label}
    </a>
  );
}
