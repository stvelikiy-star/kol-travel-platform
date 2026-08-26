"use client";

import { useState } from "react";
import type { ProductStatus } from "@/types";
import { useCart, type CartItem } from "@/components/cart/CartRuntime";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";

type AddToCartPanelProps = {
  itemId: string;
  itemType: CartItem["itemType"];
  businessId: string;
  partnerName: string;
  title: string;
  price: number;
  currency: "KGS";
  status: ProductStatus;
  quantity?: number;
  className?: string;
};

const statusLabel: Record<ProductStatus, string> = {
  active: "В наличии",
  out_of_stock: "Нет в наличии",
  stopped: "Временно недоступно",
  hidden: "Скрыто",
  under_review: "На проверке"
};

export function AddToCartPanel({
  itemId,
  itemType,
  businessId,
  partnerName,
  title,
  price,
  currency,
  status,
  quantity = 1,
  className
}: AddToCartPanelProps) {
  const { addItem } = useCart();
  const [selectedQuantity, setSelectedQuantity] = useState(quantity);
  const [added, setAdded] = useState(false);
  const isDisabled = status !== "active";
  const total = price * selectedQuantity;

  function handleAdd() {
    if (isDisabled) return;
    addItem({ id: itemId, itemType, businessId, partnerName, title, price, currency, status, quantity: selectedQuantity });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  }

  return (
    <Card className={cn("border-border/90 shadow-card", className)}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>Выберите количество. Наличие перепроверяется перед оформлением заказа.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input aria-label={`Количество: ${title}`} min={1} onChange={(event) => setSelectedQuantity(Math.max(1, Number(event.target.value) || 1))} type="number" value={selectedQuantity} />
        <div className="grid gap-2 rounded-md border border-border/80 bg-background p-3 text-sm">
          <div className="flex items-center justify-between gap-3"><span className="text-muted">Цена</span><span className="font-semibold">{price} {currency}</span></div>
          <div className="flex items-center justify-between gap-3"><span className="text-muted">Предварительно</span><span className="font-semibold">{total} {currency}</span></div>
          <div className="flex items-center justify-between gap-3"><span className="text-muted">Наличие</span><Badge variant={isDisabled ? "danger" : "success"}>{statusLabel[status]}</Badge></div>
        </div>
        <Button className="w-full" disabled={isDisabled} onClick={handleAdd}>
          {isDisabled ? "Недоступно" : added ? "Добавлено ✓" : "Добавить в корзину"}
        </Button>
        {added ? <p className="text-center text-xs font-semibold text-success" role="status">Позиция добавлена в корзину.</p> : null}
      </CardContent>
    </Card>
  );
}
