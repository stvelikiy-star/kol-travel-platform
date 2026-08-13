import { PartnerLayout } from "@/components/layout/PartnerLayout";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
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
import { getPartners } from "@/lib/data/partners";

const partnerOrders = getPartnerOrders();
const partnerBookings = getPartnerBookings();
const partners = getPartners();

const reviews = [
  {
    client: "Айдана",
    rating: 5,
    text: "Быстро подтвердили заказ, всё приехало аккуратно и горячим.",
    related: `Заказ ${partnerOrders[0]?.id ?? "demo-order"}`,
    status: "new"
  },
  {
    client: "Тимур",
    rating: 4,
    text: "Номер чистый, вид на озеро отличный. Хотелось бы быстрее ответ по брони.",
    related: `Бронь ${partnerBookings[0]?.id ?? "demo-booking"}`,
    status: "replied"
  },
  {
    client: "Мээрим",
    rating: 3,
    text: "Доставка задержалась из-за пробок, поддержка помогла разобраться.",
    related: `Заказ ${partnerOrders[1]?.id ?? "demo-order-2"}`,
    status: "hidden"
  }
];

export default function PartnerReviewsPage() {
  const partnerRating = partners[0]?.rating ?? 4.8;

  return (
    <PartnerLayout>
      <section className="space-y-6">
        <div className="rounded-lg border border-primary/20 bg-primary/10 p-5">
          <Badge variant="info">Demo mode</Badge>
          <h2 className="mt-3 text-2xl font-semibold text-foreground">Отзывы</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            Отзывы показаны как demo CRM. Реальная модерация, ответы и скрытие отзывов
            будут подключены после backend и правил платформы.
          </p>
        </div>

        <Card className="overflow-hidden">
          <div className="grid gap-5 p-5 lg:grid-cols-[260px_minmax(0,1fr)]">
            <div className="rounded-lg bg-gradient-to-br from-primary to-secondary p-5 text-white">
              <p className="text-sm text-white/80">Средний рейтинг</p>
              <p className="mt-2 text-5xl font-semibold">{partnerRating.toFixed(1)}</p>
              <p className="mt-2 text-sm text-white/80">На основе demo-отзывов партнёра.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Средний рейтинг" value={partnerRating.toFixed(1)} />
              <StatCard label="Новые отзывы" value="1" />
              <StatCard label="Требуют ответа" value="2" />
              <StatCard label="Скрытые demo" value="1" />
            </div>
          </div>
        </Card>

        <div className="grid gap-4">
          {reviews.map((review) => (
            <Card key={`${review.client}-${review.related}`}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{review.client}</CardTitle>
                    <CardDescription>{review.related}</CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="warning">{review.rating} / 5</Badge>
                    <ReviewStatus status={review.status} />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="rounded-lg border border-border bg-background p-4 text-sm leading-6 text-foreground">
                  {review.text}
                </p>
              </CardContent>
              <CardFooter>
                <Button>Ответить demo</Button>
                <Button variant="outline">Скрыть demo</Button>
                <Button variant="ghost">Открыть заказ/бронь demo</Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </section>
    </PartnerLayout>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function ReviewStatus({ status }: { status: string }) {
  const variant: BadgeVariant = status === "new" ? "info" : status === "replied" ? "success" : "muted";
  const label = status === "new" ? "new" : status === "replied" ? "replied" : "hidden";

  return <Badge variant={variant}>{label}</Badge>;
}
