import { PartnerLayout } from "@/components/layout/PartnerLayout";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { getPartnerCabinetSummaryReadResult } from "@/lib/data/partners";

export default async function PartnerReviewsPage() {
  const partnerResult = await getPartnerCabinetSummaryReadResult();
  const rating = partnerResult.ok ? partnerResult.data.rating : undefined;

  return (
    <PartnerLayout>
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-secondary via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">KÖL Reviews</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Отзывы</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
            Отзывы будут связаны с подтверждёнными заказами и бронированиями. Пока источник отзывов не подключён, KÖL не придумывает тексты, имена клиентов, статусы модерации или ответы партнёра.
          </p>
        </div>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2">
        <Card><CardContent className="p-5"><p className="text-sm text-muted">Подтверждённый рейтинг бизнеса</p><p className="mt-3 text-3xl font-semibold text-primary">{rating ?? "—"}</p><Badge className="mt-3" variant={partnerResult.ok ? "success" : "muted"}>{partnerResult.ok ? "Профиль бизнеса" : "Недоступно"}</Badge></CardContent></Card>
        <Card className="border-warning/40 bg-warning/10"><CardContent className="p-5 text-sm font-medium leading-6 text-foreground">Количество отзывов, новые ответы и доля обработанных отзывов появятся только после подключения реального источника отзывов.</CardContent></Card>
      </section>

      <Card>
        <CardHeader><CardTitle>Как будет работать раздел отзывов</CardTitle><CardDescription>Только проверяемые отзывы и контролируемые ответы партнёра.</CardDescription></CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <Requirement>Отзыв связывается с подтверждённым заказом или бронированием и конкретным бизнесом.</Requirement>
          <Requirement>Партнёр видит только отзывы своего бизнеса.</Requirement>
          <Requirement>Ответ партнёра сохраняется через проверенный серверный процесс и журнал изменений.</Requirement>
          <Requirement>Скрытие и модерация остаются отдельной административной функцией.</Requirement>
        </CardContent>
      </Card>
    </PartnerLayout>
  );
}

function Requirement({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border border-border bg-background p-3 font-medium leading-6 text-foreground">{children}</div>;
}
