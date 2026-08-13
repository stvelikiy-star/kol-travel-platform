import { ClientLayout } from "@/components/layout/ClientLayout";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";

const history = [
  { title: "Начисление за завершённый заказ", points: "+88", date: "18.06.2026", kind: "order" },
  { title: "Бонус за бронь тура", points: "+250", date: "17.06.2026", kind: "booking" },
  { title: "Списание на скидку", points: "-120", date: "16.06.2026", kind: "promo" }
];

const rules = [
  "Баллы начисляются после статуса completed.",
  "Отменённые заказы, rejected и no-show не дают начисления.",
  "Списание баллов будет проверяться на checkout после auth."
];

export default function ClientLoyaltyPage() {
  return (
    <ClientLayout>
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-primary via-secondary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">Loyalty</Badge>
          <h2 className="mt-4 text-3xl font-semibold">1 240 баллов</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/85">
            Demo-баланс клиента. Реальное начисление, списание и tiers будут подключены позже.
          </p>
        </div>
      </Card>

      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>История начислений</CardTitle>
            <CardDescription>Timeline demo-транзакций loyalty account.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {history.map((item) => (
              <div className="flex gap-3 rounded-lg border border-border bg-background p-4" key={item.title}>
                <div className="mt-1 h-3 w-3 rounded-full bg-primary" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-semibold">{item.title}</p>
                    <Badge variant={item.points.startsWith("+") ? "success" : "warning"}>{item.points}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted">{item.date} · {item.kind}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Правила начисления</CardTitle>
            <CardDescription>Короткие правила для будущей loyalty logic.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {rules.map((rule) => (
              <div className="rounded-lg border border-border bg-background p-4 text-sm font-medium" key={rule}>
                {rule}
              </div>
            ))}
          </CardContent>
          <CardFooter>
            <StyledLink href="/client/offers" label="Смотреть офферы" />
            <StyledLink href="/tours" label="Найти туры" variant="outline" />
            <StyledLink href="/food" label="Заказать еду" variant="outline" />
          </CardFooter>
        </Card>
      </section>
    </ClientLayout>
  );
}

function StyledLink({ href, label, variant = "primary" }: { href: string; label: string; variant?: "primary" | "outline" }) {
  return (
    <a
      className={
        variant === "primary"
          ? "inline-flex min-h-11 items-center justify-center rounded-md border border-primary bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
          : "inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:border-primary hover:text-primary"
      }
      href={href}
    >
      {label}
    </a>
  );
}
