"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

const publicLinks = [
  { label: "Главная", href: "/" },
  { label: "Туры", href: "/tours" },
  { label: "Жильё", href: "/stays" },
  { label: "Еда", href: "/food" },
  { label: "Магазин", href: "/shop" },
  { label: "Партнёры", href: "/partners" },
  { label: "Собственник", href: "/owner" },
  { label: "Корзина", href: "/cart" }
];

const roleLinks = [
  { label: "Клиент", href: "/client" },
  { label: "Партнёр", href: "/partner" },
  { label: "Курьер", href: "/courier" },
  { label: "Администратор", href: "/admin" }
];

type MobileNavProps = {
  className?: string;
};

export function MobileNav({ className }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={cn("shrink-0 lg:hidden", className)}>
      <Button
        aria-expanded={isOpen}
        aria-label={isOpen ? "Закрыть меню" : "Открыть меню"}
        className="min-h-10 px-3"
        onClick={() => setIsOpen((current) => !current)}
        variant="outline"
      >
        {isOpen ? "Закрыть" : "Меню"}
      </Button>

      {isOpen ? (
        <div className="absolute left-3 right-3 top-16 z-40 max-h-[calc(100vh-5rem)] overflow-y-auto rounded-lg border border-border/80 bg-surface/95 p-3 shadow-soft backdrop-blur-xl sm:left-4 sm:right-4 sm:top-20 sm:p-4">
          <nav className="grid gap-2 sm:grid-cols-2">
            {publicLinks.map((link) => (
              <Link
                className="flex min-h-11 items-center rounded-md px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-lake-light hover:text-primary"
                href={link.href}
                key={link.href}
                onClick={() => setIsOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="my-4 h-px bg-border" />
          <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted">Рабочие кабинеты</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {roleLinks.map((link) => (
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:border-primary hover:bg-lake-light hover:text-primary"
                href={link.href}
                key={link.href}
                onClick={() => setIsOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
