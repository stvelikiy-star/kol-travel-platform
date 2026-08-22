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
          <Badge className="border-white/30 bg-white text-primary">Reviews locked</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Отзывы</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
            KÖL не генерирует тексты отзывов, имена клиентов, статусы модерации или ответы партнёра. Список откроется только после появления scoped reviews backend.
          </p>
        </div>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2">
        <Card><CardContent className="p-5"><p className="text-sm text-muted">Подтверждённый rating из partner profile</p><p className="mt-3 text-3xl font-semibold text-primary">{rating ?? "—"}</p><Badge className="mt-3" variant={partnerResult.ok ? "success" : "muted"}>{partnerResult.ok ? "profile read" : "unavailable"}</Badge></CardContent></Card>
        <Card className="border-warning/40 bg-warning/10"><CardContent className="p-5 text-sm font-medium leading-6 text-foreground">Количество отзывов, new/replied/hidden и reply rate не рассчитываются без настоящей reviews table/event source.</CardContent></Card>
      </section>

      <Card>
        <CardHeader><CardTitle>Что требуется для reviews CRM</CardTitle><CardDescription>Без этих компонентов UI остаётся read-locked.</CardDescription></CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <Requirement>Review records, связанные с подтверждённым заказом/бронью и business_id.</Requirement>
          <Requirement>Partner-scoped RLS для чтения только своих отзывов.</Requirement>
          <Requirement>Server action для ответа с audit log.</Requirement>
          <Requirement>Admin-only moderation/hide workflow вместо partner fake action.</Requirement>
        </CardContent>
      </Card>
    </PartnerLayout>
  );
}

function Requirement({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border border-border bg-background p-3 font-medium text-foreground">{children}</div>;
}
