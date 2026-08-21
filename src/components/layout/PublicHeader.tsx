"use client";

import Link from "next/link";
import { useCart } from "@/components/cart/CartRuntime";
import { MobileNav } from "@/components/layout/MobileNav";
import { Container } from "@/components/ui/Container";
import { cn } from "@/lib/cn";

const publicLinks = [
  { label: "Жильё", href: "/stays" },
  { label: "Туры", href: "/tours" },
  { label: "Еда", href: "/food" },
  { label: "Магазин", href: "/shop" }
];

type PublicHeaderProps = { className?: string };

export function PublicHeader({ className }: PublicHeaderProps) {
  const cart = useCart();
  const cartLabel = cart.hydrated && cart.itemCount > 0 ? `Корзина (${cart.itemCount})` : "Корзина";

  return (
    <header className={cn("sticky top-0 z-30 border-b border-border/80 bg-surface/92 shadow-sm backdrop-blur-xl", className)}>
      <Container className="relative flex min-h-16 items-center justify-between gap-3 py-2 sm:min-h-20 sm:gap-5 sm:py-0">
        <Link className="flex min-w-0 flex-col rounded-md px-1 transition hover:text-primary" href="/">
          <span className="text-xl font-semibold tracking-normal text-primary sm:text-2xl">KÖL</span>
          <span className="max-w-[12rem] truncate text-xs font-medium text-muted sm:max-w-none">Иссык-Куль · Ысык-Көл</span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {publicLinks.map((link) => (
            <Link
              className="rounded-lg px-3 py-2 text-sm font-semibold text-muted transition hover:bg-lake-light hover:text-primary"
              href={link.href}
              key={link.href}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link
            className="inline-flex min-h-10 items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-lake-light hover:text-primary"
            href="/cart"
          >
            {cartLabel}
          </Link>
          <Link
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-primary bg-primary px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(15,143,140,0.18)] transition hover:shadow-[0_10px_24px_rgba(15,143,140,0.24)]"
            href="/login"
          >
            Войти
          </Link>
        </div>

        <MobileNav />
      </Container>
    </header>
  );
}
