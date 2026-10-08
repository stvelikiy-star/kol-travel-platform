"use client";

import { useState } from "react";
import Link from "next/link";
import type { ProductStatus } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { useCart } from "@/components/cart/CartRuntime";
import { cn } from "@/lib/cn";

type AddToCartPanelProps = {
  title: string;
  businessId?: string;
  itemId?: string;
  itemType?: "food" | "product";
  price: number;
  currency: "KGS";
  status: ProductStatus;
  partnerName?: string;
  kind?: "food" | "product";
  className?: string;
};

export function AddToCartPanel({ title, businessId, itemId, price, currency, status, partnerName = "", kind = "product", className }: AddToCartPanelProps) {
  const isDisabled = status === "out_of_stock" || status === "stopped";
  const cart = useCart();
  const [added, setAdded] = useState(false);
  const itemType = kind === "food" ? "food" : "product";

  function addToCart() {
    if (isDisabled) return;
    cart.addItem({
      id: itemId ?? `${itemType}:${title}`,
      itemType,
      businessId: businessId ?? "unknown",
      title,
      partnerName,
      price,
      currency,
      status
    });
    setAdded(true);
  }

  return (
    <Card className={cn("border-border/90 shadow-card", className)}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>Отправьте заявку. Оператор подтвердит наличие, цену и способ получения.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 rounded-md border border-border/80 bg-background p-3 text-sm">
          <div className="flex items-center justify-between gap-3"><span className="text-muted">Цена в каталоге</span><span className="font-semibold">{price} {currency}</span></div>
          <div className="flex items-center justify-between gap-3"><span className="text-muted">Статус</span><Badge variant={isDisabled ? "danger" : "success"}>{status}</Badge></div>
        </div>
        {isDisabled ? (
          <span className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-semibold text-muted opacity-70">Сейчас недоступно</span>
        ) : (
          <div className="grid gap-2">
            <button className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-primary bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90" onClick={addToCart} type="button">
              {added ? "Добавлено в корзину" : "Добавить в корзину"}
            </button>
            {added ? <Link className="inline-flex min-h-10 w-full items-center justify-center rounded-md border border-primary/40 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-lake-light" href="/delivery">Перейти к доставке</Link> : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
