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

function KolMark() {
  return (
    <span className="kol-brand" aria-label="КЁЛ — всё рядом">
      <span className="kol-brand__word">К<span className="kol-brand__lake">Ё</span>Л</span>
      <span className="kol-brand__tagline">ВСЁ РЯДОМ</span>
    </span>
  );
}

export function PublicHeader({ className }: PublicHeaderProps) {
  return (
    <header className={cn("sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur-xl", className)}>
      <Container className="relative flex min-h-16 items-center justify-between gap-3 py-2 sm:min-h-20 sm:gap-5 sm:py-0">
        <Link className="shrink-0 rounded-md px-1 transition hover:opacity-85" href="/">
          <KolMark />
        </Link>

        <nav className="hidden items-center gap-3 xl:flex">
          {publicLinks.map((link) => (
            <Link className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-cyan-50 hover:text-primary" href={link.href} key={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-primary bg-primary px-5 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(15,143,140,0.24)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(15,143,140,0.3)]" href="/checkout">
            <span aria-hidden="true">▣</span> Собрать поездку
          </Link>
        </div>
        <MobileNav />
      </Container>
    </header>
  );
}
