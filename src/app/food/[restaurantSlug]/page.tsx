import { EmptyState } from "@/components/catalog/EmptyState";
import { AddToCartPanel } from "@/components/cart/AddToCartPanel";
import { CartSummaryPreview } from "@/components/cart/CartSummaryPreview";
import { FoodCard } from "@/components/cards/FoodCard";
import { PartnerCard } from "@/components/cards/PartnerCard";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { getPublicFoodReadResult } from "@/lib/data/public-catalog-read";
import { getPublicPartnersReadResult } from "@/lib/data/public-partners-read";

type FoodDetailPageProps = {
  params: Promise<{ restaurantSlug: string }>;
};

const businessStatusVariant = { online: "success", paused: "warning", offline: "muted" } as const;
const businessStatusLabel = { online: "Принимает заказы", paused: "Приём заказов приостановлен", offline: "Сейчас закрыто" } as const;

export default async function FoodDetailPage({ params }: FoodDetailPageProps) {
  const { restaurantSlug } = await params;
  const [partnersResult, foodResult] = await Promise.all([
    getPublicPartnersReadResult(),
    getPublicFoodReadResult()
  ]);
  const partner = partnersResult.items.find((item) => item.slug === restaurantSlug);
  const isFoodPartner = partner?.type === "restaurant" || partner?.type === "cafe";

  if (!partner || !isFoodPartner) {
    return (
      <main className="min-h-screen bg-background text-foreground"><PublicHeader /><Container className="py-10"><EmptyState actionLabel="Вернуться к еде" description="Заведение не найдено или сейчас недоступно." href="/food" title="Заведение не найдено" /></Container><PublicFooter /></main>
    );
  }

  const menu = foodResult.items.filter((food) => food.businessId === partner.id);
  const categories = Array.from(new Set(menu.map((food) => food.category)));
  const similarPartners = partnersResult.items.filter((item) => item.id !== partner.id && (item.type === "restaurant" || item.type === "cafe")).slice(0, 3);
  const isUnavailable = partner.businessStatus !== "online";

  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <Container className="space-y-10 py-10">
        <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2"><Badge>{partner.location}</Badge><Badge variant={businessStatusVariant[partner.businessStatus]}>{businessStatusLabel[partner.businessStatus]}</Badge><Badge variant="success">★ {partner.rating}</Badge></div>
            <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">{partner.title}</h1>
            <p className="text-lg leading-8 text-muted">{partner.description}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Card><CardContent className="p-4"><p className="text-sm text-muted">Получение заказа</p><p className="font-semibold">Условия партнёра</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-sm text-muted">Минимальный заказ</p><p className="font-semibold">Уточняется при оформлении</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-sm text-muted">Категории</p><p className="font-semibold">{categories.length || "Скоро"}</p></CardContent></Card>
            </div>
          </div>
          <div className="aspect-[4/3] rounded-lg bg-gradient-to-br from-accent via-primary to-secondary p-5 text-white"><div className="flex h-full flex-col justify-between"><Badge className="border-white/40 bg-white text-primary">KÖL Food</Badge><p className="text-2xl font-semibold">Меню и заказ в одном месте</p></div></div>
        </section>

        {isUnavailable ? <Card className="border-warning"><CardContent className="p-5 text-sm leading-6 text-muted">Заведение временно не принимает новые заказы. Уже принятые заказы продолжают обрабатываться по своему статусу.</CardContent></Card> : null}

        <section className="space-y-5"><SectionTitle title="Категории меню" description="Быстрый выбор нужного раздела меню." /><div className="flex flex-wrap gap-2">{categories.map((category) => <Badge key={category} variant="muted">{category}</Badge>)}</div></section>

        <section className="space-y-5">
          <SectionTitle title="Меню" description="Выберите блюда и подготовьте заказ к оформлению." />
          {menu.length > 0 ? (
            <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
              <div className="grid gap-4 md:grid-cols-2">
                {menu.map((food) => (
                  <div className="space-y-4" key={food.id}>
                    <FoodCard food={food} partnerName={partner.title} partnerSlug={partner.slug} />
                    <AddToCartPanel businessId={food.businessId} currency={food.currency} itemId={food.id} itemType="food" partnerName={partner.title} price={food.price} status={isUnavailable ? "stopped" : food.status} title={food.title} />
                  </div>
                ))}
              </div>
              <CartSummaryPreview />
            </div>
          ) : <EmptyState actionLabel="Вернуться к еде" description="Меню этого заведения пока не опубликовано." href="/food" title="Меню обновляется" />}
        </section>

        <section className="space-y-5"><SectionTitle title="Похожие заведения" description="Другие рестораны и кафе на Иссык-Куле." /><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{similarPartners.map((item) => <PartnerCard key={item.id} partner={item} />)}</div></section>
      </Container>
      <PublicFooter />
    </main>
  );
}
