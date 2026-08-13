import type { ProductStatus } from "@/types";
import { EmptyState } from "@/components/catalog/EmptyState";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { mockFood } from "@/data/mockFood";
import { mockPartners } from "@/data/mockPartners";
import { mockProducts } from "@/data/mockProducts";

type CartLine = {
  id: string;
  title: string;
  partnerName: string;
  quantity: number;
  price: number;
  currency: "KGS";
  status: ProductStatus;
};

const statusVariants: Record<ProductStatus, BadgeVariant> = {
  active: "success",
  out_of_stock: "warning",
  hidden: "muted",
  stopped: "danger",
  under_review: "info"
};

function getPartnerName(businessId: string) {
  return mockPartners.find((partner) => partner.id === businessId)?.title ?? "KÖL Partner";
}

const foodCartItems: CartLine[] = mockFood.slice(0, 2).map((item, index) => ({
  id: item.id,
  title: item.title,
  partnerName: getPartnerName(item.businessId),
  quantity: index + 1,
  price: item.price,
  currency: item.currency,
  status: index === 1 ? "out_of_stock" : item.status
}));

const productCartItems: CartLine[] = mockProducts.slice(0, 2).map((item, index) => ({
  id: item.id,
  title: item.title,
  partnerName: getPartnerName(item.businessId),
  quantity: index + 2,
  price: item.price,
  currency: item.currency,
  status: item.status
}));

const allItems = [...foodCartItems, ...productCartItems];
const subtotal = allItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
const deliveryFee = 150;
const discount = 0;
const points = 0;
const total = subtotal + deliveryFee - discount - points;
const hasUnavailableItems = allItems.some(
  (item) => item.status === "out_of_stock" || item.status === "stopped"
);
const isEmpty = allItems.length === 0;

function CartGroup({ title, items }: { title: string; items: CartLine[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{items.length} позиции в demo cart</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((item) => {
          const lineTotal = item.price * item.quantity;
          const isUnavailable = item.status === "out_of_stock" || item.status === "stopped";

          return (
            <div className="rounded-lg border border-border/90 bg-surface/80 p-4 shadow-sm transition hover:shadow-card" key={item.id}>
              <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={statusVariants[item.status]}>{item.status}</Badge>
                    <Badge variant="muted">{item.partnerName}</Badge>
                  </div>
                  <h3 className="text-lg font-semibold leading-7">{item.title}</h3>
                  <p className="text-sm text-muted">
                    {item.price} {item.currency} · subtotal {lineTotal} {item.currency}
                  </p>
                  {isUnavailable ? (
                    <p className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm font-medium text-foreground">
                      Позиция стала недоступна. Удалите её или замените перед оформлением.
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-[auto_auto] lg:grid-cols-1">
                  <div className="flex items-center gap-2">
                    <Button className="min-h-10 px-3" variant="outline">-</Button>
                    <span className="inline-flex min-h-10 min-w-12 items-center justify-center rounded-md border border-border bg-surface px-3 text-sm font-semibold">
                      {item.quantity}
                    </span>
                    <Button className="min-h-10 px-3" variant="outline">+</Button>
                  </div>
                  <Button variant="ghost">Удалить</Button>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default function CartPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <Container className="space-y-8 py-10">
        <SectionTitle
          description="Проверьте блюда и товары перед оформлением заказа."
          eyebrow="Demo cart"
          title="Корзина"
        />

        {isEmpty ? (
          <Card>
            <CardContent className="grid gap-4 p-6">
              <EmptyState
                actionLabel="Смотреть еду"
                description="Добавьте блюда, товары или выберите тур/жильё для бронирования."
                href="/food"
                title="Корзина пуста"
              />
              <a
                className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:border-primary hover:text-primary sm:w-auto"
                href="/shop"
              >
                Смотреть магазин
              </a>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
            <div className="space-y-6">
              {hasUnavailableItems ? (
                <Card className="border-warning/40 bg-warning/10">
                  <CardContent className="p-5 text-sm font-medium leading-6 text-foreground">
                    Некоторые позиции стали недоступны. Удалите их или замените перед оформлением.
                  </CardContent>
                </Card>
              ) : null}

              <CartGroup items={foodCartItems} title="Ресторан / кафе" />
              <CartGroup items={productCartItems} title="Магазин" />

              <Card className="bg-lake-light/50">
                <CardContent className="p-5 text-sm font-medium leading-6 text-foreground">
                  На следующем этапе будет создана страница оформления заказа. Сейчас корзина
                  работает в demo mode.
                </CardContent>
              </Card>
            </div>

            <Card className="lg:sticky lg:top-24 lg:shadow-soft">
              <CardHeader>
                <CardTitle>Итого</CardTitle>
                <CardDescription>Demo summary без реального cart state.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 rounded-md border border-border/80 bg-background p-4 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted">Subtotal</span>
                    <span className="font-semibold">{subtotal} KGS</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted">Delivery placeholder</span>
                    <span className="font-semibold">{deliveryFee} KGS</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted">Discount placeholder</span>
                    <span className="font-semibold">-{discount} KGS</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted">Points placeholder</span>
                    <span className="font-semibold">-{points} KGS</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
                    <span className="font-semibold">Total</span>
                    <span className="text-lg font-semibold">{total} KGS</span>
                  </div>
                </div>
                {hasUnavailableItems ? (
                  <Button className="w-full" disabled>
                    Перейти к оформлению
                  </Button>
                ) : (
                  <a
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-primary bg-primary px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(15,143,140,0.22)] transition hover:shadow-[0_10px_24px_rgba(15,143,140,0.28)]"
                    href="/checkout"
                  >
                    Перейти к оформлению
                  </a>
                )}
                {hasUnavailableItems ? (
                  <p className="text-sm leading-6 text-muted">
                    Checkout disabled, пока в корзине есть недоступные позиции.
                  </p>
                ) : null}
                <a
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:border-primary hover:bg-lake-light hover:text-primary"
                  href="/food"
                >
                  Продолжить покупки
                </a>
              </CardContent>
            </Card>
          </div>
        )}
      </Container>
      <PublicFooter />
    </main>
  );
}
