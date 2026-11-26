import { ClientLayout } from "@/components/layout/ClientLayout";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { readClientLoyalty } from "@/lib/data/client-loyalty-read";

const rules = [
  "Баллы начисляются после выполнения заказа.",
  "За отменённые, отклонённые заказы и неявку баллы не начисляются.",
  "Списание баллов будет проверяться при оформлении заказа после входа в аккаунт."
];

export default async function ClientLoyaltyPage() {
  const loyalty = await readClientLoyalty();
  const isMock = loyalty.source === "mock";
  const isUnavailable = loyalty.status === "unavailable";

  return (
    <ClientLayout>
      <Card className="overflow-hidden">
        <div className="bg-linear-to-br from-primary via-secondary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">Программа лояльности</Badge>
          <h2 className="mt-4 text-3xl font-semibold">
            {loyalty.balance === null ? "Баланс недоступен" : `${loyalty.balance.toLocaleString("ru-RU")} баллов`}
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/85">
            {isMock
              ? "Показан демонстрационный баланс. Начисление, списание и уровни программы лояльности пока не подключены."
              : isUnavailable
                ? "Не удалось загрузить данные программы лояльности. Попробуйте позже."
                : "Баланс программы лояльности. Начисление и списание пока недоступны."}
          </p>
        </div>
      </Card>

      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>История начислений</CardTitle>
            <CardDescription>
              {isMock ? "Демонстрационная история операций программы лояльности." : "История операций вашей программы лояльности."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loyalty.transactions.map((item) => (
              <div className="flex gap-3 rounded-lg border border-border bg-background p-4" key={item.id}>
                <div className="mt-1 h-3 w-3 rounded-full bg-primary" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-semibold">{item.title}</p>
                    <Badge variant={item.points >= 0 ? "success" : "warning"}>
                      {item.points > 0 ? `+${item.points}` : item.points}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted">{item.date} · {item.kind}</p>
                </div>
              </div>
            ))}
            {loyalty.transactions.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-background p-5 text-sm text-muted">
                {isUnavailable ? "История сейчас недоступна." : "История операций пока пуста."}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Правила начисления</CardTitle>
            <CardDescription>Основные правила будущей программы лояльности.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {rules.map((rule) => (
              <div className="rounded-lg border border-border bg-background p-4 text-sm font-medium" key={rule}>
                {rule}
              </div>
            ))}
          </CardContent>
          <CardFooter>
            <StyledLink href="/client/offers" label="Смотреть предложения" />
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
          ? "inline-flex min-h-11 items-center justify-center rounded-md border border-primary bg-primary px-4 py-2 text-sm font-semibold text-white shadow-xs transition hover:opacity-90"
          : "inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground shadow-xs transition hover:border-primary hover:text-primary"
      }
      href={href}
    >
      {label}
    </a>
  );
}
