"use client";

import Link from "next/link";
import { useCart } from "@/components/cart/CartRuntime";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

export function CartPageClient() {
  const cart = useCart();

  if (!cart.hydrated) return <Card><CardContent className="p-6 text-sm text-muted">Загружаем корзину…</CardContent></Card>;
  if (cart.items.length === 0) return <Card><CardHeader><CardTitle>Корзина пока пуста</CardTitle><CardDescription>Добавьте еду или товары в разделе доставки.</CardDescription></CardHeader><CardContent><Link className="inline-flex min-h-11 items-center justify-center rounded-md border border-primary bg-primary px-5 py-2 text-sm font-semibold text-white" href="/delivery">Открыть доставку</Link></CardContent></Card>;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
      <Card>
        <CardHeader><CardTitle>Выбранные позиции</CardTitle><CardDescription>{cart.itemCount} позиций · можно объединить еду и товары в одной заявке.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          {cart.items.map((item) => (
            <div className="grid gap-3 rounded-xl border border-border/80 bg-background p-4 sm:grid-cols-[1fr_auto] sm:items-center" key={`${item.itemType}-${item.id}`}>
              <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge variant="muted">{item.itemType === "food" ? "Еда" : "Товар"}</Badge><span className="font-semibold">{item.title}</span></div><p className="mt-1 text-sm text-muted">{item.partnerName} · {item.price} KGS за единицу</p></div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <Button aria-label={`Уменьшить количество ${item.title}`} className="min-h-9 min-w-9 px-2" onClick={() => cart.setQuantity(item.id, item.itemType, item.quantity - 1)} variant="outline">−</Button>
                <span aria-label={`Количество ${item.title}`} className="min-w-8 text-center font-semibold">{item.quantity}</span>
                <Button aria-label={`Увеличить количество ${item.title}`} className="min-h-9 min-w-9 px-2" onClick={() => cart.setQuantity(item.id, item.itemType, item.quantity + 1)} variant="outline">+</Button>
                <Button className="min-h-9 px-3" onClick={() => cart.removeItem(item.id, item.itemType)} variant="ghost">Удалить</Button>
              </div>
            </div>
          ))}
          <Button className="mt-2" onClick={cart.clear} variant="ghost">Очистить корзину</Button>
        </CardContent>
      </Card>
      <Card className="lg:sticky lg:top-24">
        <CardHeader><CardTitle>Итого</CardTitle><CardDescription>Доставка и финальная цена подтверждаются оператором.</CardDescription></CardHeader>
        <CardContent className="space-y-4"><div className="flex items-center justify-between border-b border-border pb-3 text-sm"><span className="text-muted">Товары</span><span className="font-semibold">{cart.subtotal} KGS</span></div><div className="flex items-center justify-between text-lg"><span className="font-semibold">Предварительно</span><span className="font-semibold text-primary">{cart.subtotal} KGS</span></div><Link className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-primary bg-primary px-5 py-2 text-sm font-semibold text-white" href="/checkout">Перейти к оформлению</Link><Link className="inline-flex min-h-10 w-full items-center justify-center rounded-md border border-border px-4 py-2 text-sm font-semibold" href="/delivery">Добавить ещё</Link></CardContent>
      </Card>
    </div>
  );
}
