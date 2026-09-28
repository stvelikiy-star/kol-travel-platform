import Link from "next/link";
import { FoodCard } from "@/components/cards/FoodCard";
import { ProductCard } from "@/components/cards/ProductCard";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { getPublicFoodReadResult } from "@/lib/data/public-catalog-read";
import { getPublicPartnersReadResult } from "@/lib/data/public-partners-read";
import { getPublicShopReadResult } from "@/lib/data/public-shop-read";

export default async function DeliveryPage() {
  const [foodResult, shopResult, partnersResult] = await Promise.all([
    getPublicFoodReadResult(),
    getPublicShopReadResult(),
    getPublicPartnersReadResult()
  ]);
  const partners = partnersResult.items;
  const partner = (businessId: string) => partners.find((item) => item.id === businessId);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <Container className="space-y-10 py-10">
        <SectionTitle eyebrow="Доставка KÖL" title="Еда и товары с доставкой" description="Выберите готовую еду или нужные товары. Корзина и заявка остаются едиными — не нужно разбираться в разных разделах." />
        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/food"><Card className="h-full transition hover:border-primary"><CardHeader><CardTitle>Рестораны и готовая еда</CardTitle></CardHeader><CardContent className="text-sm text-muted">Кафе, рестораны, завтраки, национальная кухня и другие блюда.</CardContent></Card></Link>
          <Link href="/shop"><Card className="h-full transition hover:border-primary"><CardHeader><CardTitle>Продукты и товары</CardTitle></CardHeader><CardContent className="text-sm text-muted">Продукты, товары для отдыха, пляжа, мангала и другие необходимые вещи.</CardContent></Card></Link>
        </div>
        {foodResult.items.length > 0 ? <section className="space-y-5"><SectionTitle title="Еда" description="Популярные предложения ресторанов и кафе." /><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{foodResult.items.slice(0,6).map((food)=>{const p=partner(food.businessId);return <FoodCard food={food} key={food.id} partnerName={p?.title ?? "KÖL Partner"} partnerSlug={p?.slug}/>;})}</div><Link className="font-semibold text-primary" href="/food">Вся еда →</Link></section> : null}
        {shopResult.items.length > 0 ? <section className="space-y-5"><SectionTitle title="Товары" description="Продукты и всё необходимое для отдыха." /><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{shopResult.items.slice(0,6).map((product)=>{const p=partner(product.businessId);return <ProductCard key={product.id} partnerName={p?.title ?? "KÖL Partner"} partnerSlug={p?.slug} product={product}/>;})}</div><Link className="font-semibold text-primary" href="/shop">Все товары →</Link></section> : null}
        <Card><CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">Не нашли нужное?</p><p className="text-sm text-muted">Оставьте одну заявку — оператор уточнит наличие, цену и доставку.</p></div><Link className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-5 py-2 text-sm font-semibold text-white" href="/checkout">Оставить заявку</Link></CardContent></Card>
      </Container>
      <PublicFooter />
    </main>
  );
}
