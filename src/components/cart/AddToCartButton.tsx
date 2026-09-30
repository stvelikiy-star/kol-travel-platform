"use client";

import { useState } from "react";
import { useCart } from "@/components/cart/CartRuntime";
import { Button } from "@/components/ui/Button";
import type { ProductStatus } from "@/types";

type AddToCartButtonProps = {
  id: string;
  itemType: "food" | "product";
  businessId: string;
  title: string;
  partnerName: string;
  price: number;
  currency: "KGS";
  status: ProductStatus;
};

export function AddToCartButton({ id, itemType, businessId, title, partnerName, price, currency, status }: AddToCartButtonProps) {
  const cart = useCart();
  const [added, setAdded] = useState(false);
  const disabled = status === "out_of_stock" || status === "stopped";

  return (
    <div className="grid w-full gap-2">
      <Button
        className="w-full"
        disabled={disabled}
        onClick={() => {
          cart.addItem({ id, itemType, businessId, title, partnerName, price, currency, status });
          setAdded(true);
          window.setTimeout(() => setAdded(false), 1800);
        }}
      >
        {disabled ? "Сейчас недоступно" : added ? "Добавлено в корзину" : "Добавить в корзину"}
      </Button>
      {added ? <a className="text-center text-sm font-semibold text-primary" href="/cart">Открыть корзину</a> : null}
    </div>
  );
}
