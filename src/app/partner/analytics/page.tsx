import { PartnerLayout } from "@/components/layout/PartnerLayout";
import {readPartnerOperationsAnalytics} from "@/lib/analytics/operations";
import {currentBishkekFinanceMonth} from "@/lib/finance/report-period";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { getPartnerBookingsReadResult } from "@/lib/data/partner-bookings-read";
import { getPartnerOrdersReadResult } from "@/lib/data/partner-orders-read";
import { getPartnerCabinetSummaryReadResult } from "@/lib/data/partners";

export default async function PartnerAnalyticsPage() {
  const period=currentBishkekFinanceMonth();
  const [bookingResult, orderResult, partnerResult, operations] = await Promise.all([
    getPartnerBookingsReadResult(),
    getPartnerOrdersReadResult(),
    getPartnerCabinetSummaryReadResult(),
    readPartnerOperationsAnalytics(period)
  ]);
  const bookings = bookingResult.ok ? bookingResult.data : [];
  const orders = orderResult.ok ? orderResult.orders : [];
  const partner = partnerResult.ok ? partnerResult.data : undefined;
  const ordersAvailable = orderResult.ok || orderResult.code === "empty_result";
  const unavailable = !bookingResult.ok || !ordersAvailable || !partnerResult.ok;

  return (
    <PartnerLayout>
      <Card className="overflow-hidden">
        <div className="bg-linear-to-br from-secondary via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">Analytics read-only</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Аналитика</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
            Здесь показаны только проверенные данные заказов, бронирований и профиля вашего бизнеса. Конверсия, источники трафика, часы пик и доля повторных клиентов не рассчитываются без подтверждённого источника.
          </p>
        </div>
      </Card>

      {unavailable ? (
        <Card className="border-danger/40 bg-danger/10"><CardContent className="p-4 text-sm font-medium">Часть аналитических данных недоступна. KÖL не подменяет их вымышленными процентами или графиками.</CardContent></Card>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Metric label="Заказы моего бизнеса" value={ordersAvailable ? String(orders.length) : "—"} />
        <Metric label="Бронирования моего бизнеса" value={bookingResult.ok ? String(bookings.length) : "—"} />
        <Metric label="Рейтинг партнёра" value={partnerResult.ok ? String(partner?.rating ?? "—") : "—"} />
      </section>


      <Card>
       <CardHeader><CardTitle>Подтверждённая операционная статистика за месяц</CardTitle>
        <CardDescription>Источник — зарегистрированные операции только вашего бизнеса; часовой пояс — Бишкек.</CardDescription>
       </CardHeader>
       <CardContent className="space-y-4">
        {!operations.ok?<p className="text-sm text-muted">Серверная аналитика недоступна. Чужие данные или демо-показатели не показываются.</p>:(
         <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
           <Metric label="Заказы за месяц" value={String(operations.data.orders.count)}/>
           <Metric label="Брони за месяц" value={String(operations.data.bookings.count)}/>
           <Metric label="Повторные клиенты в периоде" value={String(operations.data.clients.repeat_in_period)}/>
           <Metric label="Доставки" value={String(operations.data.deliveries.count)}/>
          </div>
          <div className="space-y-2">
           <p className="text-sm font-semibold">Дни активности</p>
           {operations.data.daily.filter(d=>d.orders+d.bookings>0).slice(-12).map(d=>
             <p className="rounded-lg border border-border bg-background p-3 text-sm" key={d.date}>
               {d.date}: заказы {d.orders}, брони {d.bookings}, завершено {d.completed_orders+d.completed_bookings}
             </p>)}
          </div>
          <p className="text-sm text-muted">Конверсия, посещаемость, источники трафика и чистая прибыль — Не подтверждено. Нужна отдельная телеметрия и финансовая сверка.</p>
         </>
        )}
       </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Доступные факты</CardTitle><CardDescription>Без предположений о маркетинговой эффективности.</CardDescription></CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <Fact>Количество заказов и бронирований вашего бизнеса.</Fact>
            <Fact>Статусы и суммы внутри доступных записей.</Fact>
            <Fact>Подтверждённый рейтинг из профиля партнёра, если он доступен.</Fact>
          </CardContent>
        </Card>

        <Card className="border-warning/40 bg-warning/10">
          <CardHeader><CardTitle>Что ещё не считается</CardTitle><CardDescription>Требуется отдельная серверная система аналитики событий.</CardDescription></CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <Fact>Конверсия и источники привлечения клиентов.</Fact>
            <Fact>Источники трафика и эффективность рекламных кампаний.</Fact>
            <Fact>Доля повторных клиентов и клиентские группы.</Fact>
            <Fact>Часы пик, задержки обслуживания, выручка и выплаты.</Fact>
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
