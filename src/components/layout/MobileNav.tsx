"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

const publicLinks = [
  { label: "Главная", href: "/" },
  { label: "Туры", href: "/tours" },
  { label: "Жильё", href: "/stays" },
  { label: "Доставка", href: "/delivery" },
  { label: "Партнёрам", href: "/partners" },
  { label: "Контакты", href: "/contacts" }
];

type MobileNavProps = { className?: string };

export function MobileNav({ className }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className={cn("shrink-0 xl:hidden", className)}>
      <Button aria-expanded={isOpen} aria-label={isOpen ? "Закрыть меню" : "Открыть меню"} className="min-h-10 px-3" onClick={() => setIsOpen((current) => !current)} variant="outline">
        {isOpen ? "Закрыть" : "Меню"}
      </Button>
      {isOpen ? (
        <div className="absolute left-3 right-3 top-16 z-40 max-h-[calc(100vh-5rem)] overflow-y-auto rounded-2xl border border-slate-200/80 bg-white/95 p-3 shadow-soft backdrop-blur-xl sm:left-4 sm:right-4 sm:top-20 sm:p-4">
          <nav className="grid gap-2">
            {publicLinks.map((link) => (
              <a className="flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-cyan-50 hover:text-primary" href={link.href} key={link.href}>{link.label}</a>
            ))}
          </nav>
          <div className="mt-4 grid gap-2">
            <a className="inline-flex min-h-11 items-center justify-center rounded-xl border border-primary/40 bg-white px-4 py-2 text-sm font-semibold text-primary transition hover:bg-cyan-50" href="/register">
              Кабинет без пароля
            </a>
            <a className="inline-flex min-h-11 items-center justify-center rounded-xl border border-primary bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90" href="/checkout">
              Собрать поездку
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
