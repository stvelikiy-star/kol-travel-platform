"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
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
  const root=useRef<HTMLDivElement>(null);
  const pathname=usePathname();
  useEffect(()=>{setIsOpen(false);},[pathname]);
  useEffect(()=>{
    if(!isOpen)return;
    const close=(event:KeyboardEvent)=>{if(event.key==="Escape"){setIsOpen(false);root.current?.querySelector("button")?.focus();}};
    const outside=(event:PointerEvent)=>{if(event.target instanceof Node&&!root.current?.contains(event.target))setIsOpen(false);};
    document.addEventListener("keydown",close);document.addEventListener("pointerdown",outside);
    return ()=>{document.removeEventListener("keydown",close);document.removeEventListener("pointerdown",outside);};
  },[isOpen]);
  return (
    <div ref={root} className={cn("shrink-0 lg:hidden", className)}>
      <Button aria-controls="kol-public-mobile-menu" aria-expanded={isOpen} aria-label={isOpen ? "Закрыть меню" : "Открыть меню"} className="min-h-11 min-w-11 px-3" onClick={() => setIsOpen((current) => !current)} variant="outline">
        {isOpen ? "Закрыть" : "Меню"}
      </Button>
      {isOpen ? (
        <div id="kol-public-mobile-menu" className="absolute left-3 right-3 top-full z-40 max-h-[calc(100dvh-6rem-env(safe-area-inset-bottom))] overflow-y-auto rounded-lg border border-border/80 bg-surface/95 p-3 shadow-soft backdrop-blur-xl sm:left-4 sm:right-4 sm:p-4">
          <nav className="grid gap-2">
            {publicLinks.map((link) => (
              <a aria-current={pathname===link.href?"page":undefined} onClick={()=>setIsOpen(false)} className="flex min-h-11 items-center rounded-md px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-lake-light hover:text-primary" href={link.href} key={link.href}>{link.label}</a>
            ))}
          </nav>
          <div className="mt-4 grid gap-2">
            <a className="inline-flex min-h-11 items-center justify-center rounded-md border border-primary bg-primary px-4 py-2 text-sm font-semibold text-white shadow-xs transition hover:opacity-90" href="/checkout">
              Оставить заявку
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
