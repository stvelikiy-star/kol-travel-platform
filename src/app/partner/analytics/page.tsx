import { PartnerLayout } from "@/components/layout/PartnerLayout";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { getPartnerBookingsReadResult } from "@/lib/data/partner-bookings-read";
import { getPartnerOrdersReadResult } from "@/lib/data/partner-orders-read";
import { getPartnerCabinetSummaryReadResult } from "@/lib/data/partners";

export default async function PartnerAnalyticsPage() {
  const [bookingResult, orderResult, partnerResult] = await Promise.all([
    getPartnerBookingsReadResult(),
    getPartnerOrdersReadResult(),
    getPartnerCabinetSummaryReadResult()
  ]);
  const bookings = bookingResult.ok ? bookingResult.data : [];
  const orders = orderResult.ok ? orderResult.orders : [];
  const partner = partnerResult.ok ? partnerResult.data : undefined;
  const unavailable = !bookingResult.ok || !orderResult.ok || !partnerResult.ok;

  return (
    <PartnerLayout>
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-secondary via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">Analytics read-only</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Аналитика</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
            Экран показывает только агрегаты, которые можно вывести непосредственно из partner-scoped orders/bookings/profile reads. Конверсия, источники трафика, peak hours и проценты повторных клиентов не придумываются.
          </p>
        </div>
      </Card>

      {unavailable ? (
        <Card className="border-danger/40 bg-danger/10"><CardContent className="p-4 text-sm font-medium">Часть источников аналитики недоступна. KÖL не заполняет пробелы mock-процентами или графиками.</CardContent></Card>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Metric label="Заказы в scope" value={orderResult.ok ? String(orders.length) : "—"} />
        <Metric label="Брони в scope" value={bookingResult.ok ? String(bookings.length) : "—"} />
        <Metric label="Рейтинг партнёра" value={partnerResult.ok ? String(partner?.rating ?? "—") : "—"} />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Доступные факты</CardTitle><CardDescription>Без предположений о маркетинговой эффективности.</CardDescription></CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <Fact>Количество scoped заказов и броней.</Fact>
            <Fact>Статусы и суммы внутри доступных записей.</Fact>
            <Fact>Подтверждённый рейтинг из partner profile, если он есть.</Fact>
          </CardContent>
        </Card>

        <Card className="border-warning/40 bg-warning/10">
          <CardHeader><CardTitle>Что ещё не считается</CardTitle><CardDescription>Нужен отдельный analytics/event backend.</CardDescription></CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <Fact>Conversion rate и attribution.</Fact>
            <Fact>Traffic sources и campaign performance.</Fact>
            <Fact>Repeat-customer rate и cohorts.</Fact>
            <Fact>Peak hours, SLA delay analytics и revenue/payout metrics.</Fact>
          </CardContent>
        </Card>
      </div>
    </PartnerLayout>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <Card><CardContent className="p-5"><p className="text-sm text-muted">{label}</p><p className="mt-3 text-2xl font-semibold text-foreground">{value}</p><Badge className="mt-3" variant="muted">verified aggregate</Badge></CardContent></Card>;
}

function Fact({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border border-border bg-background p-3 font-medium text-foreground">{children}</div>;
}
