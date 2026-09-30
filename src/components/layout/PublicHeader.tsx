import Image from "next/image";
import Link from "next/link";
import { CartLink } from "@/components/cart/CartLink";
import { MobileNav } from "@/components/layout/MobileNav";
import { Container } from "@/components/ui/Container";
import { PremiumIcon } from "@/components/ui/PremiumIcon";
import { cn } from "@/lib/cn";

const publicLinks = [
  { label: "Главная", href: "/" },
  { label: "Туры", href: "/tours" },
  { label: "Жильё", href: "/stays" },
  { label: "Доставка", href: "/delivery" },
  { label: "Партнёры", href: "/partners" },
  { label: "Контакты", href: "/contacts" }
];

type PublicHeaderProps = { className?: string };

export function PublicHeader({ className }: PublicHeaderProps) {
  return (
    <header className={cn("sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur-xl", className)}>
      <Container className="relative flex min-h-16 items-center justify-between gap-3 py-2 sm:min-h-20 sm:gap-5 sm:py-0">
        <Link className="shrink-0 rounded-md px-1 transition hover:opacity-85" href="/">
          <Image alt="KÖL — Всё рядом" className="h-auto w-[88px] sm:w-[116px]" height={76} priority src="/media/kol/kol-logo.jpg" width={300} />
        </Link>

        <nav className="hidden items-center gap-1.5 xl:flex 2xl:gap-3">
          {publicLinks.map((link) => (
            <Link className="rounded-lg px-2.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-cyan-50 hover:text-primary 2xl:px-3" href={link.href} key={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 xl:flex">
          <CartLink />
          <Link className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-primary bg-primary px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(15,143,140,0.24)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(15,143,140,0.3)] 2xl:px-5" href="/checkout">
            <PremiumIcon name="calendar" size={24} /> Собрать поездку
          </Link>
        </div>
        <div className="flex items-center gap-2 xl:hidden">
          <CartLink className="hidden sm:inline-flex" />
          <MobileNav />
        </div>
      </Container>
    </header>
  );
}
