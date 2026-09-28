import Image from "next/image";
import Link from "next/link";
import { MobileNav } from "@/components/layout/MobileNav";
import { Container } from "@/components/ui/Container";
import { cn } from "@/lib/cn";

const publicLinks = [
  { label: "Главная", href: "/" },
  { label: "Туры", href: "/tours" },
  { label: "Жильё", href: "/stays" },
  { label: "Еда", href: "/food" },
  { label: "Магазин", href: "/shop" },
  { label: "Партнёрам", href: "/partners" },
  { label: "Контакты", href: "/contacts" }
];

type PublicHeaderProps = { className?: string };

export function PublicHeader({ className }: PublicHeaderProps) {
  return (
    <header className={cn("sticky top-0 z-30 border-b border-border/80 bg-surface/90 shadow-sm backdrop-blur-xl", className)}>
      <Container className="relative flex min-h-16 items-center justify-between gap-3 py-2 sm:min-h-20 sm:gap-4 sm:py-0">
        <Link aria-label="KÖL — Всё рядом" className="flex shrink-0 items-center rounded-xl bg-white px-2 py-1 transition hover:opacity-90" href="/">
          <Image alt="KÖЛ — Всё рядом" className="h-auto w-[92px] sm:w-[116px]" height={76} priority src="/media/kol/kol-logo.jpg" width={300} />
        </Link>

        <nav className="hidden items-center gap-5 lg:flex">
          {publicLinks.map((link) => (
            <Link className="rounded-md px-2 py-2 text-sm font-semibold text-muted transition hover:bg-lake-light hover:text-primary" href={link.href} key={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link className="inline-flex min-h-11 items-center justify-center rounded-md border border-primary bg-primary px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(15,143,140,0.22)] transition hover:shadow-[0_10px_24px_rgba(15,143,140,0.28)]" href="/checkout">
            Оставить заявку
          </Link>
        </div>
        <MobileNav />
      </Container>
    </header>
  );
}
