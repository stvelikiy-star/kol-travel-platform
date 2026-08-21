import { EmptyState } from "@/components/catalog/EmptyState";
import { AddToCartPanel } from "@/components/cart/AddToCartPanel";
import { CartSummaryPreview } from "@/components/cart/CartSummaryPreview";
import { ProductCard } from "@/components/cards/ProductCard";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { getProducts } from "@/lib/data/catalog";
import { getPartnerBySlug, getPartners } from "@/lib/data/partners";

type ShopDetailPageProps = {
  params: Promise<{ shopSlug: string }>;
};

const businessStatusVariant = {
  online: "success",
  paused: "warning",
  offline: "muted"
} as const;

const businessStatusLabel = {
  online: "Принимает заказы",
  paused: "Приём заказов приостановлен",
  offline: "Сейчас закрыто"
} as const;

export function generateStaticParams() {
  return getPartners()
    .filter((partner) => partner.type === "shop")
    .map((partner) => ({ shopSlug: partner.slug }));
}

export default async function ShopDetailPage({ params }: ShopDetailPageProps) {
  const { shopSlug } = await params;
  const partner = getPartnerBySlug(shopSlug);

  if (!partner || partner.type !== "shop") {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <PublicHeader />
        <Container className="py-10">
          <EmptyState
            actionLabel="Вернуться в магазин"
            description="Магазин не найден или сейчас недоступен."
            href="/shop"
            title="Магазин не найден"
          />
        </Container>
        <PublicFooter />
      </main>
    );
  }

  const products = getProducts().filter((product) => product.businessId === partner.id);
  const categories = Array.from(new Set(products.map((product) => product.category)));
  const isUnavailable = partner.businessStatus !== "online";
  const hasUnavailableProducts = products.some(
    (product) => product.status === "out_of_stock" || product.status === "stopped"
  );
  const cartSubtotal = products.slice(0, 2).reduce((sum, item) => sum + item.price, 0);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <Container className="space-y-10 py-10">
        <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              <Badge>{partner.location}</Badge>
              <Badge variant={businessStatusVariant[partner.businessStatus]}>
                {businessStatusLabel[partner.businessStatus]}
              </Badge>
              <Badge variant="success">★ {partner.rating}</Badge>
            </div>
            <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">{partner.title}</h1>
            <p className="text-lg leading-8 text-muted">{partner.description}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted">Товары</p>
                  <p className="font-semibold">{products.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted">Категории</p>
                  <p className="font-semibold">{categories.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted">Получение заказа</p>
                  <p className="font-semibold">Условия партнёра</p>
                </CardContent>
              </Card>
            </div>
          </div>
          <div className="aspect-[4/3] rounded-lg bg-gradient-to-br from-[#d7b56d] via-accent to-primary p-5 text-white">
            <div className="flex h-full flex-col justify-between">
              <Badge className="border-white/40 bg-white text-primary">KÖL Shop</Badge>
              <p className="text-2xl font-semibold">Нужные товары рядом</p>
            </div>
          </div>
        </section>

        {isUnavailable ? (
          <Card className="border-warning">
            <CardContent className="p-5 text-sm leading-6 text-muted">
              Магазин временно не принимает новые заказы. Уже принятые заказы продолжают обрабатываться по своему статусу.
            </CardContent>
          </Card>
        ) : null}

        {hasUnavailableProducts ? (
          <Card className="border-warning">
            <CardContent className="p-5 text-sm leading-6 text-muted">
              Часть товаров временно недоступна. Добавление таких позиций в заказ отключено.
            </CardContent>
          </Card>
        ) : null}

        <section className="space-y-5">
          <SectionTitle title="Категории товаров" description="Быстрый выбор нужного раздела магазина." />
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <Badge key={category} variant="muted">{category}</Badge>
            ))}
          </div>
        </section>

        <section className="space-y-5">
          <SectionTitle title="Товары" description="Выберите товары и подготовьте заказ к оформлению." />
          {products.length > 0 ? (
            <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
              <div className="grid gap-4 md:grid-cols-2">
                {products.map((product) => (
                  <div className="space-y-4" key={product.id}>
                    <ProductCard
                      partnerName={partner.title}
                      partnerSlug={partner.slug}
                      product={product}
                      stockLabel={product.status === "active" ? "В наличии" : "Недоступно"}
                    />
                    <AddToCartPanel
                      currency={product.currency}
                      price={product.price}
                      status={product.status}
                      title={product.title}
                    />
                  </div>
                ))}
              </div>
              <CartSummaryPreview itemCount={Math.min(products.length, 2)} subtotal={cartSubtotal} />
            </div>
          ) : (
            <EmptyState
              actionLabel="Вернуться в магазин"
              description="Каталог этого магазина пока не опубликован."
              href="/shop"
              title="Товары обновляются"
            />
          )}
        </section>
      </Container>
      <PublicFooter />
    </main>
  );
}
