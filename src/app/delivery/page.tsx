import Link from "next/link";
import { CartSummaryPreview } from "@/components/cart/CartSummaryPreview";
import { FoodCard } from "@/components/cards/FoodCard";
import { ProductCard } from "@/components/cards/ProductCard";
import { EmptyState } from "@/components/catalog/EmptyState";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { Input } from "@/components/ui/Input";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Select } from "@/components/ui/Select";
import { getPublicFoodReadResult } from "@/lib/data/public-catalog-read";
import { getPublicPartnersReadResult } from "@/lib/data/public-partners-read";
import { getPublicShopReadResult } from "@/lib/data/public-shop-read";
import { presentationMedia } from "@/lib/presentation-media";

type PageSearchParams = Promise<Record<string, string | string[] | undefined>>;
type DeliveryTab = "all" | "food" | "shop";

const locationOptions = ["Чолпон-Ата", "Бостери", "Тамчы", "Сары-Ой"];

function valueOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function DeliveryPage({ searchParams }: { searchParams: PageSearchParams }) {
  const params = await searchParams;
  const requestedTab = valueOf(params.tab);
  const tab: DeliveryTab = requestedTab === "food" || requestedTab === "shop" ? requestedTab : "all";
  const q = valueOf(params.q).trim().toLocaleLowerCase("ru");
  const location = valueOf(params.location);
  const category = valueOf(params.category);
  const sort = valueOf(params.sort) || "in-stock";
  const [foodResult, shopResult, partnersResult] = await Promise.all([
    getPublicFoodReadResult(),
    getPublicShopReadResult(),
    getPublicPartnersReadResult()
  ]);
  const partnersById = new Map(partnersResult.items.map((partner) => [partner.id, partner]));
  const partnerFor = (businessId: string) => partnersById.get(businessId);
  const partnerName = (businessId: string) => partnerFor(businessId)?.title ?? "KÖL Partner";
  const matchesCommon = (businessId: string, title: string, description: string, itemCategory: string) => {
    const partner = partnerFor(businessId);
    const searchText = `${title} ${description} ${partnerName(businessId)}`.toLocaleLowerCase("ru");
    return (!q || searchText.includes(q)) && (!location || location === "all" || partner?.location === location) && (!category || category === "all" || itemCategory === category);
  };
  const foods = foodResult.items
    .filter((food) => matchesCommon(food.businessId, food.title, food.description, food.category))
    .sort((a, b) => sort === "price-desc" ? b.price - a.price : sort === "title" ? a.title.localeCompare(b.title, "ru") : a.price - b.price);
  const products = shopResult.items
    .filter((product) => matchesCommon(product.businessId, product.title, product.description, product.category))
    .sort((a, b) => sort === "price-asc" ? a.price - b.price : sort === "price-desc" ? b.price - a.price : sort === "title" ? a.title.localeCompare(b.title, "ru") : (a.status === "active" ? 0 : 1) - (b.status === "active" ? 0 : 1));
  const visibleFood = tab === "shop" ? [] : foods;
  const visibleProducts = tab === "food" ? [] : products;
  const resultCount = visibleFood.length + visibleProducts.length;
  const categories = Array.from(new Set([
    ...(tab === "shop" ? [] : foodResult.items.map((item) => item.category)),
    ...(tab === "food" ? [] : shopResult.items.map((item) => item.category))
  ])).sort((a, b) => a.localeCompare(b, "ru"));

  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <section className="kol-catalog-hero relative overflow-hidden text-white">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url("${presentationMedia.kolDelivery}")` }} />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/55 to-slate-950/20" />
        <Container className="relative py-14 sm:py-16">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-200">КЁЛ · ВСЁ РЯДОМ</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">Доставка для отдыха</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/82 sm:text-lg">Готовая еда, продукты и нужные товары — в одной витрине и одной корзине.</p>
        </Container>
      </section>

      <Container className="space-y-10 py-10">
        <section className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
          <div className="space-y-8">
            <SectionTitle description="Выберите блюда или товары, добавьте их в одну корзину и оставьте единую заявку оператору." eyebrow="Доставка KÖL" title="Еда и покупки в одном месте" />
            <nav aria-label="Категории доставки" className="grid grid-cols-3 gap-2 rounded-2xl border border-border/90 bg-surface p-2 shadow-card">
              <DeliveryTabLink active={tab === "all"} href="/delivery" label="Все" />
              <DeliveryTabLink active={tab === "food"} href="/delivery?tab=food" label="Еда" />
              <DeliveryTabLink active={tab === "shop"} href="/delivery?tab=shop" label="Товары" />
            </nav>

            <form className="grid gap-3 rounded-2xl border border-border/90 bg-surface/90 p-4 shadow-card sm:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr_1fr_auto]" method="get">
              <input name="tab" type="hidden" value={tab} />
              <Input defaultValue={valueOf(params.q)} name="q" placeholder="Поиск еды или товара" />
              <Select defaultValue={location || "all"} name="location"><option value="all">Локация</option>{locationOptions.map((item) => <option key={item} value={item}>{item}</option>)}</Select>
              <Select defaultValue={category || "all"} name="category"><option value="all">Категория</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</Select>
              <Select defaultValue={sort} name="sort"><option value="in-stock">Сначала доступные</option><option value="price-asc">Цена ↑</option><option value="price-desc">Цена ↓</option><option value="title">По названию</option></Select>
              <button className="min-h-11 rounded-md border border-primary bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90" type="submit">Найти</button>
            </form>

            <p aria-live="polite" className="text-sm font-semibold text-muted">Найдено предложений: <span className="text-primary">{resultCount}</span></p>
            {resultCount === 0 ? <EmptyState actionLabel="Сбросить фильтры" description="Попробуйте другую категорию, локацию или поисковый запрос." href="/delivery" title="Предложения не найдены" /> : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {visibleFood.map((food) => { const partner = partnerFor(food.businessId); return <FoodCard action="cart" food={food} key={food.id} partnerName={partner?.title ?? "KÖL Partner"} partnerSlug={partner?.slug} />; })}
                {visibleProducts.map((product) => { const partner = partnerFor(product.businessId); return <ProductCard action="cart" key={product.id} partnerName={partner?.title ?? "KÖL Partner"} partnerSlug={partner?.slug} product={product} stockLabel={product.status === "active" ? "В наличии" : "Недоступно"} />; })}
              </div>
            )}
          </div>
          <CartSummaryPreview />
        </section>

        <Card className="border-primary/20 bg-lake-light/40"><CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><Badge variant="info">Одна заявка</Badge><Badge variant="muted">Без регистрации</Badge></div><p className="mt-2 font-semibold">Можно заказать еду и товары вместе</p><p className="text-sm leading-6 text-muted">Оператор уточнит наличие, итоговую цену, время и способ получения.</p></div><Link className="inline-flex min-h-11 items-center justify-center rounded-md border border-primary bg-primary px-5 py-2 text-sm font-semibold text-white" href="/checkout">Оформить заявку</Link></CardContent></Card>
      </Container>
      <PublicFooter />
    </main>
  );
}

function DeliveryTabLink({ active, href, label }: { active: boolean; href: string; label: string }) {
  return <Link aria-current={active ? "page" : undefined} className={active ? "flex min-h-11 items-center justify-center rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm" : "flex min-h-11 items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold text-muted transition hover:bg-lake-light hover:text-primary"} href={href}>{label}</Link>;
}
