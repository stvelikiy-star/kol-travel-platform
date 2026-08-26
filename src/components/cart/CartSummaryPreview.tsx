"use client";

import Link from "next/link";
import { useCart } from "@/components/cart/CartRuntime";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

type CartSummaryPreviewProps = {
  itemCount?: number;
  subtotal?: number;
  currency?: "KGS";
  className?: string;
};

export function CartSummaryPreview({ itemCount = 0, subtotal = 0, currency = "KGS", className }: CartSummaryPreviewProps) {
  const cart = useCart();
  const visibleItemCount = cart.hydrated ? cart.itemCount : itemCount;
  const visibleSubtotal = cart.hydrated ? cart.subtotal : subtotal;

  return (
    <Card className={cn("lg:sticky lg:top-24 lg:shadow-soft", className)}>
      <CardHeader>
        <CardTitle>Ваш заказ</CardTitle>
        <CardDescription>Проверьте выбранные позиции перед оформлением.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 rounded-md border border-border/80 bg-background p-4 text-sm">
          <div className="flex items-center justify-between gap-3"><span className="text-muted">Позиции</span><span className="font-semibold">{visibleItemCount}</span></div>
          <div className="flex items-center justify-between gap-3"><span className="text-muted">Стоимость товаров</span><span className="font-semibold">{visibleSubtotal} {currency}</span></div>
          <div className="flex items-center justify-between gap-3"><span className="text-muted">Получение / доставка</span><span className="font-semibold">Рассчитывается при оформлении</span></div>
          <div className="flex items-center justify-between gap-3 border-t border-border pt-3"><span className="font-semibold">Предварительная сумма</span><span className="text-lg font-semibold">{visibleSubtotal} {currency}</span></div>
        </div>
        {visibleItemCount > 0 ? (
          <Link className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-primary bg-primary px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(15,143,140,0.22)] transition hover:shadow-[0_10px_24px_rgba(15,143,140,0.28)]" href="/cart">Открыть корзину</Link>
        ) : (
          <p className="rounded-md border border-border bg-background p-3 text-center text-sm text-muted">Корзина пока пуста.</p>
        )}
        <p className="text-xs leading-5 text-muted">Итоговая сумма зависит от способа получения и подтверждается перед созданием заказа.</p>
      </CardContent>
    </Card>
  );
}
