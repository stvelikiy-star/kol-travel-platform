"use client";

import Link from "next/link";
import type { ProductStatus } from "@/types";
import { useCart, type CartItem } from "@/components/cart/CartRuntime";
import { EmptyState } from "@/components/catalog/EmptyState";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { SectionTitle } from "@/components/ui/SectionTitle";

const statusVariants: Record<ProductStatus, BadgeVariant> = {
  active: "success",
  out_of_stock: "warning",
  hidden: "muted",
  stopped: "danger",
  under_review: "info"
};

const statusLabels: Record<ProductStatus, string> = {
  active: "В наличии",
  out_of_stock: "Нет в наличии",
  hidden: "Скрыто",
  stopped: "Недоступно",
  under_review: "На проверке"
};

function CartGroup({ title, items }: { title: string; items: CartItem[] }) {
  const { setQuantity, removeItem } = useCart();
  if (items.length === 0) return null;

  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle><CardDescription>{items.length} поз.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        {items.map((item) => {
          const lineTotal = item.price * item.quantity;
          const isUnavailable = item.status !== "active";
          return (
            <div className="rounded-lg border border-border/90 bg-surface/80 p-4 shadow-sm" key={`${item.itemType}:${item.id}`}>
              <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2"><Badge variant={statusVariants[item.status]}>{statusLabels[item.status]}</Badge><Badge variant="muted">{item.partnerName}</Badge></div>
                  <h3 className="text-lg font-semibold leading-7">{item.title}</h3>
                  <p className="text-sm text-muted">{item.price} {item.currency} × {item.quantity} = {lineTotal} {item.currency}</p>
                  {isUnavailable ? <p className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm font-medium text-foreground">Позиция недоступна. Удалите её перед оформлением.</p> : null}
                </div>
                <div className="grid gap-3 sm:grid-cols-[auto_auto] lg:grid-cols-1">
                  <div className="flex items-center gap-2">
                    <Button aria-label={`Уменьшить ${item.title}`} className="min-h-10 px-3" disabled={item.quantity <= 1} onClick={() => setQuantity(item.id, item.itemType, item.quantity - 1)} variant="outline">−</Button>
                    <span className="inline-flex min-h-10 min-w-12 items-center justify-center rounded-md border border-border bg-surface px-3 text-sm font-semibold" aria-live="polite">{item.quantity}</span>
                    <Button aria-label={`Увеличить ${item.title}`} className="min-h-10 px-3" onClick={() => setQuantity(item.id, item.itemType, item.quantity + 1)} variant="outline">+</Button>
                  </div>
                  <Button onClick={() => removeItem(item.id, item.itemType)} variant="ghost">Удалить</Button>
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
  const cart = useCart();
  const foodItems = cart.items.filter((item) => item.itemType === "food");
  const productItems = cart.items.filter((item) => item.itemType === "product");
  const hasUnavailableItems = cart.items.some((item) => item.status !== "active");
  const isEmpty = cart.hydrated && cart.items.length === 0;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <Container className="space-y-8 py-10">
        <SectionTitle description="Проверьте блюда и товары перед оформлением заказа." eyebrow="KÖL cart" title="Корзина" />

        {!cart.hydrated ? (
          <Card><CardContent className="p-6 text-sm text-muted">Загружаем корзину…</CardContent></Card>
        ) : isEmpty ? (
          <Card>
            <CardContent className="grid gap-4 p-6">
              <EmptyState actionLabel="Смотреть еду" description="Добавьте блюда или товары из каталога." href="/food" title="Корзина пуста" />
              <Link className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:border-primary hover:text-primary sm:w-auto" href="/shop">Смотреть магазин</Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
            <div className="space-y-6">
              {hasUnavailableItems ? <Card className="border-warning/40 bg-warning/10"><CardContent className="p-5 text-sm font-medium leading-6 text-foreground">В корзине есть недоступные позиции. Удалите их перед оформлением.</CardContent></Card> : null}
              <CartGroup items={foodItems} title="Ресторан / кафе" />
              <CartGroup items={productItems} title="Магазин" />
              <Button onClick={cart.clear} variant="ghost">Очистить корзину</Button>
            </div>

            <Card className="lg:sticky lg:top-24 lg:shadow-soft">
              <CardHeader><CardTitle>Итого</CardTitle><CardDescription>Сумма выбранных товаров. Доставка рассчитывается отдельно при оформлении.</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 rounded-md border border-border/80 bg-background p-4 text-sm">
                  <div className="flex items-center justify-between gap-3"><span className="text-muted">Позиции</span><span className="font-semibold">{cart.itemCount}</span></div>
                  <div className="flex items-center justify-between gap-3"><span className="font-semibold">Товары</span><span className="text-lg font-semibold">{cart.subtotal} KGS</span></div>
                  <div className="flex items-start justify-between gap-3 border-t border-border pt-3"><span className="text-muted">Доставка</span><span className="max-w-[55%] text-right font-semibold">Определяется после выбора способа получения</span></div>
                </div>
                {hasUnavailableItems ? <Button className="w-full" disabled>Перейти к оформлению</Button> : <Link className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-primary bg-primary px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(15,143,140,0.22)] transition hover:shadow-[0_10px_24px_rgba(15,143,140,0.28)]" href="/checkout">Перейти к оформлению</Link>}
                <Link className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:border-primary hover:bg-lake-light hover:text-primary" href="/food">Продолжить покупки</Link>
              </CardContent>
            </Card>
          </div>
        )}
      </Container>
      <PublicFooter />
    </main>
  );
}
