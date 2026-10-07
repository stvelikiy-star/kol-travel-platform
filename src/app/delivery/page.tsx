import Link from "next/link";
import { AddToCartPanel } from "@/components/cart/AddToCartPanel";
import { CartSummaryPreview } from "@/components/cart/CartSummaryPreview";
import { FoodCard } from "@/components/cards/FoodCard";
import { ProductCard } from "@/components/cards/ProductCard";
import { EmptyState } from "@/components/catalog/EmptyState";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { getPublicFoodReadResult } from "@/lib/data/public-catalog-read";
import { getPublicPartnersReadResult } from "@/lib/data/public-partners-read";
import { getPublicShopReadResult } from "@/lib/data/public-shop-read";

type PageSearchParams = Promise<Record<string, string | string[] | undefined>>;

function valueOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function DeliveryPage({ searchParams }: { searchParams: PageSearchParams }) {
  const params = await searchParams;
  const q = valueOf(params.q).trim().toLocaleLowerCase("ru");
  const [foodResult, shopResult, partnersResult] = await Promise.all([
    getPublicFoodReadResult(),
    getPublicShopReadResult(),
    getPublicPartnersReadResult()
  ]);
  const partnersById = new Map(partnersResult.items.map((partner) => [partner.id, partner]));
  const partnerFor = (businessId: string) => partnersById.get(businessId);
  const foodItems = foodResult.items.filter((food) => !q || `${food.title} ${food.description}`.toLocaleLowerCase("ru").includes(q));
  const products = shopResult.items.filter((product) => !q || `${product.title} ${product.description}`.toLocaleLowerCase("ru").includes(q));

  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <Container className="space-y-10 py-10">
        <section className="rounded-[2rem] bg-gradient-to-br from-slate-950 via-[#0b3443] to-primary p-7 text-white shadow-soft sm:p-10">
          <div className="max-w-3xl space-y-5">
            <div className="flex flex-wrap gap-2">
              <Badge className="border-white/20 bg-white text-slate-950">KÖL Delivery</Badge>
              <Badge className="border-white/20 bg-white/10 text-white">Еда + магазин</Badge>
            </div>
            <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">Всё нужное для отдыха — одной заявкой</h1>
            <p className="max-w-2xl text-base leading-7 text-white/78 sm:text-lg">Выберите блюда и товары, добавьте их в корзину. Оператор подтвердит наличие, стоимость и способ получения вручную.</p>
            <div className="flex flex-wrap gap-3">
              <Link className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-50" href="#catalog">Открыть каталог</Link>
              <Link className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/30 bg-white/10 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/20" href="/checkout">Оставить свободную заявку</Link>
            </div>
          </div>
        </section>

        <Card className="border-primary/20 bg-lake-light/40">
          <CardContent className="grid gap-3 p-5 text-sm leading-6 text-muted sm:grid-cols-3">
            <div><p className="font-semibold text-foreground">1. Выберите</p><p>Еду или товары из опубликованного каталога.</p></div>
            <div><p className="font-semibold text-foreground">2. Добавьте</p><p>Проверьте корзину и укажите адрес получения.</p></div>
            <div><p className="font-semibold text-foreground">3. Подтвердите</p><p>Оператор свяжется с вами и уточнит детали.</p></div>
          </CardContent>
        </Card>

        <div className="grid gap-8 lg:grid-cols-[1fr_320px]" id="catalog">
          <div className="space-y-12">
            <section className="space-y-5">
              <SectionTitle description="Рестораны и кафе публикуются только после подтверждения партнёром." eyebrow="Еда" title="Блюда и готовая еда" />
              {foodItems.length > 0 ? (
                <div className="grid gap-5 md:grid-cols-2">
                  {foodItems.map((food) => {
                    const partner = partnerFor(food.businessId);
                    return <div className="space-y-4" key={food.id}><FoodCard food={food} partnerName={partner?.title ?? "Партнёр KÖL"} partnerSlug={partner?.slug} /><AddToCartPanel businessId={food.businessId} currency={food.currency} itemId={food.id} itemType="food" kind="food" partnerName={partner?.title ?? "Партнёр KÖL"} price={food.price} status={food.status} title={food.title} /></div>;
                  })}
                </div>
              ) : <EmptyState actionLabel="Оставить заявку оператору" description="В live-каталоге сейчас нет подтверждённых блюд. Напишите оператору, что нужно заказать, и мы уточним наличие вручную." href="/checkout" title="Каталог еды обновляется" />}
            </section>

            <section className="space-y-5">
              <SectionTitle description="Товары для отдыха, продукты и локальные покупки — в том же заказе." eyebrow="Магазин" title="Товары рядом" />
              {products.length > 0 ? (
                <div className="grid gap-5 md:grid-cols-2">
                  {products.map((product) => {
                    const partner = partnerFor(product.businessId);
                    return <div className="space-y-4" key={product.id}><ProductCard partnerName={partner?.title ?? "Партнёр KÖL"} partnerSlug={partner?.slug} product={product} /><AddToCartPanel businessId={product.businessId} currency={product.currency} itemId={product.id} itemType="product" kind="product" partnerName={partner?.title ?? "Партнёр KÖL"} price={product.price} status={product.status} title={product.title} /></div>;
                  })}
                </div>
              ) : <EmptyState actionLabel="Оставить заявку оператору" description="В live-каталоге сейчас нет подтверждённых товаров. Оставьте запрос — оператор проверит наличие у партнёров." href="/checkout" title="Каталог магазина обновляется" />}
            </section>
          </div>

          <CartSummaryPreview className="h-fit" />
        </div>
      </Container>
      <PublicFooter />
    </main>
  );
}
