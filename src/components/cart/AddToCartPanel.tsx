"use client";

import { useState } from "react";
import { useCart } from "@/components/cart/CartRuntime";
import type { ProductStatus } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
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

export function AddToCartPanel({ title, businessId = "", itemId = "", itemType, price, currency, status, partnerName = "", kind = "product", className }: AddToCartPanelProps) {
  const cart = useCart();
  const [added, setAdded] = useState(false);
  const isDisabled = status === "out_of_stock" || status === "stopped";
  const resolvedType = itemType ?? kind;
  const canAdd = Boolean(itemId && businessId);

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
        ) : canAdd ? (
          <div className="grid gap-2">
            <Button
              className="w-full"
              onClick={() => {
                cart.addItem({ id: itemId, itemType: resolvedType, businessId, title, partnerName, price, currency, status });
                setAdded(true);
                window.setTimeout(() => setAdded(false), 1800);
              }}
            >
              {added ? "Добавлено в корзину" : "Добавить в корзину"}
            </Button>
            {added ? <a className="text-center text-sm font-semibold text-primary" href="/cart">Открыть корзину</a> : null}
          </div>
        ) : (
          <a className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-primary bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90" href="/delivery">Вернуться к доставке</a>
        )}
      </CardContent>
    </Card>
  );
}
