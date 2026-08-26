import Link from "next/link";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { SectionTitle } from "@/components/ui/SectionTitle";

export default function OrderSuccessPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <Container className="space-y-8 py-10">
        <section className="rounded-2xl border border-border/80 bg-gradient-to-br from-lake-light via-surface to-sand-light p-6 shadow-soft sm:p-8">
          <SectionTitle
            description="Эта страница не подтверждает создание заказа без проверенного ответа серверной транзакции."
            eyebrow="KÖL Order"
            title="Подтверждение заказа пока недоступно"
          />
        </section>

        <Card className="mx-auto max-w-3xl border-warning/30 bg-warning/10">
          <CardHeader>
            <CardTitle>Заказ не был создан этой страницей</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 text-sm leading-6 text-foreground">
            <p>
              KÖL показывает успешный заказ только после серверной записи и проверки результата. Прямой переход на этот адрес не создаёт заказ и не меняет оплату.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2 font-semibold text-white" href="/cart">
                Вернуться в корзину
              </Link>
              <Link className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-surface px-5 py-2 font-semibold" href="/">
                На главную
              </Link>
            </div>
          </CardContent>
        </Card>
      </Container>
      <PublicFooter />
    </main>
  );
}
