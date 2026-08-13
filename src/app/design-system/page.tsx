import { FoodCard } from "@/components/cards/FoodCard";
import { OfferCard, type Offer } from "@/components/cards/OfferCard";
import { PartnerCard } from "@/components/cards/PartnerCard";
import { ProductCard } from "@/components/cards/ProductCard";
import { StayCard } from "@/components/cards/StayCard";
import { TourCard } from "@/components/cards/TourCard";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { BookingStatusBadge } from "@/components/status/BookingStatusBadge";
import { OrderStatusBadge, type ExtendedOrderStatus } from "@/components/status/OrderStatusBadge";
import { PartnerStatusBadge } from "@/components/status/PartnerStatusBadge";
import { PaymentStatusBadge } from "@/components/status/PaymentStatusBadge";
import { StopStatusBadge } from "@/components/status/StopStatusBadge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { Input } from "@/components/ui/Input";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { mockFood } from "@/data/mockFood";
import { mockPartners } from "@/data/mockPartners";
import { mockProducts } from "@/data/mockProducts";
import { mockRooms, mockStays } from "@/data/mockStays";
import { mockTours } from "@/data/mockTours";

const colorTokens = [
  { name: "background", value: "var(--background)" },
  { name: "surface", value: "var(--surface)" },
  { name: "primary", value: "var(--primary)" },
  { name: "secondary", value: "var(--secondary)" },
  { name: "accent", value: "var(--accent)" },
  { name: "sand", value: "#d7b56d" },
  { name: "lake", value: "#0f8f8c" },
  { name: "success", value: "var(--success)" },
  { name: "warning", value: "var(--warning)" },
  { name: "danger", value: "var(--danger)" },
  { name: "muted", value: "var(--muted)" },
  { name: "border", value: "var(--border)" }
];

const previewOffer: Offer = {
  id: "offer-design-preview",
  title: "Раннее бронирование у озера",
  description: "Скидка для гостей, которые бронируют жильё и туры заранее.",
  discount: "-15%",
  period: "01.07-15.07",
  partnerName: "Aurora Lake Hotel"
};

function getPartnerName(businessId: string) {
  return mockPartners.find((partner) => partner.id === businessId)?.title ?? "KÖL Partner";
}

function getPartnerSlug(businessId: string) {
  return mockPartners.find((partner) => partner.id === businessId)?.slug;
}

export default function DesignSystemPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicHeader />

      <Container className="space-y-12 py-10">
        <section className="grid gap-6 rounded-lg border border-border bg-surface p-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <SectionTitle
            description="UI-система для туристической marketplace-платформы Иссык-Куля: туры, жильё, еда, магазин, бронирование и кабинеты партнёров."
            eyebrow="Design System"
            title="KÖL Design System"
          />
          <div className="rounded-lg bg-gradient-to-br from-primary via-secondary to-accent p-6 text-white">
            <p className="text-sm font-semibold uppercase tracking-wide">Layout preview</p>
            <h2 className="mt-3 text-3xl font-semibold">Travel marketplace shell</h2>
            <p className="mt-3 text-sm leading-6">
              Demo hero block для будущих публичных страниц без каталогов и backend.
            </p>
          </div>
        </section>

        <section className="space-y-5">
          <SectionTitle title="Color palette" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {colorTokens.map((color) => (
              <Card key={color.name}>
                <div className="h-20 rounded-t-lg border-b border-border" style={{ background: color.value }} />
                <CardContent className="p-4">
                  <p className="text-sm font-semibold">{color.name}</p>
                  <p className="text-xs text-muted">{color.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-5">
          <SectionTitle title="Typography preview" />
          <Card>
            <CardContent className="space-y-4 p-5">
              <h1 className="text-4xl font-semibold leading-tight">h1 Marketplace platform</h1>
              <h2 className="text-3xl font-semibold leading-tight">h2 Tours and stays</h2>
              <h3 className="text-xl font-semibold leading-7">h3 Partner cabinet</h3>
              <p className="text-base leading-7 text-muted">
                paragraph: KÖL объединяет путешествия, доставку, бронирование и партнёрские процессы в одной системе.
              </p>
              <p className="text-sm text-muted">small text: mock/manual flows first, real integrations later.</p>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-5">
          <SectionTitle title="Buttons" />
          <div className="flex flex-wrap gap-3">
            <Button>primary</Button>
            <Button variant="secondary">secondary</Button>
            <Button variant="outline">outline</Button>
            <Button variant="ghost">ghost</Button>
            <Button variant="danger">danger</Button>
          </div>
        </section>

        <section className="space-y-5">
          <SectionTitle title="Badges" />
          <div className="flex flex-wrap gap-2">
            <Badge>default</Badge>
            <Badge variant="success">success</Badge>
            <Badge variant="warning">warning</Badge>
            <Badge variant="danger">danger</Badge>
            <Badge variant="info">info</Badge>
            <Badge variant="muted">muted</Badge>
          </div>
        </section>

        <section className="space-y-5">
          <SectionTitle title="Forms" />
          <Card>
            <CardContent className="grid gap-4 p-5 md:grid-cols-3">
              <Input placeholder="Поиск по Иссык-Кулю" />
              <Select defaultValue="tours">
                <option value="tours">Туры</option>
                <option value="stays">Жильё</option>
                <option value="food">Еда</option>
              </Select>
              <Textarea className="md:col-span-3" placeholder="Комментарий к заявке" />
            </CardContent>
          </Card>
        </section>

        <section className="space-y-5">
          <SectionTitle title="Cards" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {mockTours.slice(0, 2).map((tour) => (
              <TourCard key={tour.id} tour={tour} />
            ))}
            {mockStays.slice(0, 2).map((stay, index) => (
              <StayCard key={stay.id} room={mockRooms[index]} stay={stay} />
            ))}
            {mockFood.slice(0, 2).map((food) => (
              <FoodCard
                food={food}
                key={food.id}
                partnerName={getPartnerName(food.businessId)}
                partnerSlug={getPartnerSlug(food.businessId)}
              />
            ))}
            {mockProducts.slice(0, 2).map((product) => (
              <ProductCard
                key={product.id}
                partnerName={getPartnerName(product.businessId)}
                partnerSlug={getPartnerSlug(product.businessId)}
                product={product}
              />
            ))}
            {mockPartners.slice(0, 2).map((partner) => (
              <PartnerCard key={partner.id} partner={partner} />
            ))}
            <OfferCard offer={previewOffer} />
          </div>
        </section>

        <section className="space-y-5">
          <SectionTitle title="Status badges" />
          <Card>
            <CardContent className="grid gap-5 p-5 md:grid-cols-2 xl:grid-cols-5">
              <div className="space-y-3">
                <p className="text-sm font-semibold">Orders</p>
                <div className="flex flex-wrap gap-2">
                  {["new", "accepted", "preparing", "ready", "delivering", "completed", "rejected", "cancelled"].map((status) => (
                    <OrderStatusBadge key={status} status={status as ExtendedOrderStatus} />
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-sm font-semibold">Bookings</p>
                <div className="flex flex-wrap gap-2">
                  <BookingStatusBadge status="pending" />
                  <BookingStatusBadge status="confirmed" />
                  <BookingStatusBadge status="checked_in" />
                  <BookingStatusBadge status="completed" />
                  <BookingStatusBadge status="cancelled" />
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-sm font-semibold">Partners</p>
                <div className="flex flex-wrap gap-2">
                  <PartnerStatusBadge status="pending" />
                  <PartnerStatusBadge status="approved" />
                  <PartnerStatusBadge status="suspended" />
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-sm font-semibold">Stop</p>
                <div className="flex flex-wrap gap-2">
                  <StopStatusBadge status="online" />
                  <StopStatusBadge status="paused" />
                  <StopStatusBadge status="offline" />
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-sm font-semibold">Payments</p>
                <div className="flex flex-wrap gap-2">
                  <PaymentStatusBadge status="pending" />
                  <PaymentStatusBadge status="paid" />
                  <PaymentStatusBadge status="failed" />
                  <PaymentStatusBadge status="refunded" />
                  <PaymentStatusBadge status="cod" />
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </Container>

      <PublicFooter />
    </main>
  );
}
