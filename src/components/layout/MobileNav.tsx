"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

const publicLinks = [
  { label: "Главная", href: "/" },
  { label: "Жильё", href: "/stays" },
  { label: "Туры", href: "/tours" },
  { label: "Еда", href: "/food" },
  { label: "Магазин", href: "/shop" },
  { label: "Корзина", href: "/cart" },
  { label: "Войти", href: "/login?next=/client" }
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
        <div className="absolute left-3 right-3 top-16 z-40 max-h-[calc(100vh-5rem)] overflow-y-auto rounded-2xl border border-border/80 bg-surface/98 p-3 shadow-soft backdrop-blur-xl sm:left-4 sm:right-4 sm:top-20 sm:p-4">
          <nav className="grid gap-1 sm:grid-cols-2">
            {publicLinks.map((link) => (
              <Link
                className={cn(
                  "flex min-h-11 items-center rounded-xl px-3 py-2 text-sm font-semibold transition",
                  link.label === "Войти"
                    ? "mt-1 justify-center bg-primary text-white hover:bg-primary/90 sm:mt-0"
                    : "text-foreground hover:bg-lake-light hover:text-primary"
                )}
                href={link.href}
                key={link.href}
                onClick={() => setIsOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      ) : null}
    </div>
  );
}
