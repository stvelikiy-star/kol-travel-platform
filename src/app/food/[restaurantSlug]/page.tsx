import { EmptyState } from "@/components/catalog/EmptyState";
import { AddToCartPanel } from "@/components/cart/AddToCartPanel";
import { CartSummaryPreview } from "@/components/cart/CartSummaryPreview";
import { FoodCard } from "@/components/cards/FoodCard";
import { PartnerCard } from "@/components/cards/PartnerCard";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { getFood } from "@/lib/data/catalog";
import { getPartnerBySlug, getPartners } from "@/lib/data/partners";

type FoodDetailPageProps = {
  params: {
    restaurantSlug: string;
  };
};

const businessStatusVariant = {
  online: "success",
  paused: "warning",
  offline: "muted"
} as const;

export function generateStaticParams() {
  return getPartners()
    .filter((partner) => partner.type === "restaurant" || partner.type === "cafe")
    .map((partner) => ({ restaurantSlug: partner.slug }));
}

export default function FoodDetailPage({ params }: FoodDetailPageProps) {
  const partner = getPartnerBySlug(params.restaurantSlug);
  const isFoodPartner = partner?.type === "restaurant" || partner?.type === "cafe";

  if (!partner || !isFoodPartner) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <PublicHeader />
        <Container className="py-10">
          <EmptyState
            actionLabel="Вернуться к еде"
            description="Такого ресторана или кафе нет в mock-каталоге."
            href="/food"
            title="Заведение не найдено"
          />
        </Container>
        <PublicFooter />
      </main>
    );
  }

  const menu = getFood().filter((food) => food.businessId === partner.id);
  const categories = Array.from(new Set(menu.map((food) => food.category)));
  const similarPartners = getPartners()
    .filter(
      (item) =>
        item.id !== partner.id && (item.type === "restaurant" || item.type === "cafe")
    )
    .slice(0, 3);
  const isUnavailable = partner.businessStatus !== "online";
  const cartSubtotal = menu.slice(0, 2).reduce((sum, item) => sum + item.price, 0);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <Container className="space-y-10 py-10">
        <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              <Badge>{partner.location}</Badge>
              <Badge variant={businessStatusVariant[partner.businessStatus]}>
                {partner.businessStatus}
              </Badge>
              <Badge variant="success">★ {partner.rating}</Badge>
            </div>
            <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">{partner.title}</h1>
            <p className="text-lg leading-8 text-muted">{partner.description}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted">Доставка</p>
                  <p className="font-semibold">25-35 мин</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted">Мин. заказ</p>
                  <p className="font-semibold">500 KGS</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted">Категории</p>
                  <p className="font-semibold">{categories.length || "скоро"}</p>
                </CardContent>
              </Card>
            </div>
          </div>
          <div className="aspect-[4/3] rounded-lg bg-gradient-to-br from-accent via-primary to-secondary p-5 text-white">
            <div className="flex h-full flex-col justify-between">
              <Badge className="border-white/40 bg-white text-primary">Food partner</Badge>
              <p className="text-2xl font-semibold">Меню и доставка</p>
            </div>
          </div>
        </section>

        {isUnavailable ? (
          <Card className="border-warning">
            <CardContent className="p-5 text-sm leading-6 text-muted">
              Сейчас партнёр в статусе {partner.businessStatus}. Новые заказы могут быть
              временно недоступны, уже принятые заказы не отменяются автоматически.
            </CardContent>
          </Card>
        ) : null}

        <section className="space-y-5">
          <SectionTitle title="Категории меню" description="UI preview категорий блюд." />
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <Badge key={category} variant="muted">
                {category}
              </Badge>
            ))}
          </div>
        </section>

        <section className="space-y-5">
          <SectionTitle title="Меню" description="Блюда из mock data, CTA пока UI-only." />
          {menu.length > 0 ? (
            <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
              <div className="grid gap-4 md:grid-cols-2">
                {menu.map((food) => (
                  <div className="space-y-4" key={food.id}>
                    <FoodCard
                      food={food}
                      partnerName={partner.title}
                      partnerSlug={partner.slug}
                    />
                    <AddToCartPanel
                      currency={food.currency}
                      price={food.price}
                      status={food.status}
                      title={food.title}
                    />
                  </div>
                ))}
              </div>
              <CartSummaryPreview itemCount={Math.min(menu.length, 2)} subtotal={cartSubtotal} />
            </div>
          ) : (
            <EmptyState
              actionLabel="Вернуться к еде"
              description="У этого партнёра пока нет mock-меню."
              href="/food"
              title="Меню пустое"
            />
          )}
        </section>

        <section className="space-y-5">
          <SectionTitle title="Похожие заведения" description="Рестораны и кафе из mock data." />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {similarPartners.map((item) => (
              <PartnerCard key={item.id} partner={item} />
            ))}
          </div>
        </section>
      </Container>
      <PublicFooter />
    </main>
  );
}
