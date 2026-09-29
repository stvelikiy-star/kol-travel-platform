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
  { label: "Партнёры", href: "/partners" },
  { label: "Контакты", href: "/contacts" }
];

type PublicHeaderProps = { className?: string };

export function PublicHeader({ className }: PublicHeaderProps) {
  return (
    <header className={cn("sticky top-0 z-30 border-b border-white/70 bg-white/88 shadow-[0_10px_34px_rgba(6,43,79,0.08)] backdrop-blur-2xl", className)}>
      <Container className="relative flex min-h-16 items-center justify-between gap-3 py-2 sm:min-h-20 sm:gap-5 sm:py-0">
        <Link className="shrink-0 rounded-md px-1 transition hover:opacity-85" href="/">
          <Image alt="KÖL — Всё рядом" className="h-auto w-[104px] sm:w-[132px]" height={76} priority src="/media/kol/kol-logo.png" width={300} />
        </Link>

        <nav className="hidden items-center gap-3 xl:flex">
          {publicLinks.map((link) => (
            <Link className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-cyan-50/80 hover:text-primary" href={link.href} key={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-primary bg-primary px-5 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(15,143,140,0.24)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(15,143,140,0.3)]" href="/checkout">
            <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="M8 14h3M8 17h6"/></svg> Собрать поездку
          </Link>
        </div>
        <MobileNav />
      </Container>
    </header>
  );
}
