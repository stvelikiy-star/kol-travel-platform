"use client";

import Link from "next/link";
import { useCart } from "@/components/cart/CartRuntime";
import { cn } from "@/lib/cn";

export function CartLink({ className }: { className?: string }) {
  const { itemCount, hydrated } = useCart();
  const count = hydrated ? itemCount : 0;
  return <Link aria-label={`Корзина${count ? `, ${count} позиций` : ""}`} className={cn("inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:border-primary hover:text-primary", className)} href="/cart">Корзина{count ? <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-white">{count}</span> : null}</Link>;
}
