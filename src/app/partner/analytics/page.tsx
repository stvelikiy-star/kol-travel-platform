import { PartnerLayout } from "@/components/layout/PartnerLayout";
import { Badge } from "@/components/ui/Badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/Card";
import { getPartnerBookings } from "@/lib/data/bookings";
import { getPartnerOrders } from "@/lib/data/orders";
import { getPartners } from "@/lib/data/partners";

const partnerOrders = getPartnerOrders();
const partnerBookings = getPartnerBookings();
const partners = getPartners();
const orderTotal = partnerOrders.reduce((sum, order) => sum + order.total, 0);
const bookingTotal = partnerBookings.reduce((sum, booking) => sum + booking.total, 0);
const activityCount = partnerOrders.length + partnerBookings.length;
const averageCheck = activityCount > 0 ? Math.round((orderTotal + bookingTotal) / activityCount) : 0;

const sourceBars = [
  { label: "Главная", value: "42%", width: "42%" },
  { label: "Каталог", value: "31%", width: "31%" },
  { label: "Повторные клиенты", value: "19%", width: "19%" },
  { label: "Партнёрские ссылки", value: "8%", width: "8%" }
];

export default function PartnerAnalyticsPage() {
  return (
    <PartnerLayout>
      <section className="space-y-6">
        <div className="rounded-lg border border-primary/20 bg-primary/10 p-5">
          <Badge variant="info">Demo analytics</Badge>
          <h2 className="mt-3 text-2xl font-semibold text-foreground">Аналитика</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            Метрики рассчитаны на mock data. Реальная аналитика будет подключена после
            событий, заказов, броней и финансового учёта.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Metric label="Заказы" value={String(partnerOrders.length)} />
          <Metric label="Брони" value={String(partnerBookings.length)} />
          <Metric label="Конверсия demo" value="8.4%" />
          <Metric label="Средний чек" value={`${averageCheck.toLocaleString("ru-RU")} KGS`} />
          <Metric label="Повторные клиенты" value="24%" />
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Card>
            <CardHeader>
              <CardTitle>Активность по дням</CardTitle>
              <CardDescription>Chart-like блок без внешних библиотек.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                ["Пн", "55%"],
                ["Вт", "38%"],
                ["Ср", "64%"],
                ["Чт", "46%"],
                ["Пт", "76%"],
                ["Сб", "92%"],
                ["Вс", "88%"]
              ].map(([day, width]) => (
                <div className="grid grid-cols-[36px_1fr_48px] items-center gap-3" key={day}>
                  <span className="text-sm font-semibold text-muted">{day}</span>
                  <div className="h-3 overflow-hidden rounded-full bg-background">
                    <div className="h-full rounded-full bg-primary" style={{ width }} />
                  </div>
                  <span className="text-sm font-semibold text-foreground">{width}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Источники клиентов</CardTitle>
              <CardDescription>Demo распределение переходов.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {sourceBars.map((source) => (
                <div className="space-y-2" key={source.label}>
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="font-medium text-foreground">{source.label}</span>
                    <span className="text-muted">{source.value}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-background">
                    <div className="h-full rounded-full bg-secondary" style={{ width: source.width }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <InfoList
            title="Популярные позиции"
            items={partnerOrders.flatMap((order) => order.items).slice(0, 4).map((item) => item.title)}
          />
          <InfoList
            title="Популярные объекты брони"
            items={partnerBookings.slice(0, 4).map((booking) => booking.title)}
          />
          <InfoList
            title="Операционные инсайты"
            items={[
              "Peak hours: 18:00 - 21:00",
              "Best category: еда и туры",
              "Delivery delays demo: 2 заказа",
              `Partner rating: ${partners[0]?.rating ?? 4.8}`
            ]}
          />
        </div>
      </section>
    </PartnerLayout>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-muted">{label}</p>
        <p className="mt-3 text-2xl font-semibold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

function InfoList({ title, items }: { title: string; items: string[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => (
          <div
            className="rounded-md border border-border bg-background p-3 text-sm font-medium text-foreground"
            key={item}
          >
            {item}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
