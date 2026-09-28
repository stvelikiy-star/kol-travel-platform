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

const KOL_LOGO = "data:image/webp;base64,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";

function KolMark() {
  return <span aria-label="КЁЛ — ВСЁ РЯДОМ" className="block h-12 w-36 bg-contain bg-left bg-no-repeat sm:h-16 sm:w-48" role="img" style={{ backgroundImage: `url("${KOL_LOGO}")` }} />;
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
            <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="M8 14h3M8 17h6"/></svg> Собрать поездку
          </Link>
        </div>
        <MobileNav />
      </Container>
    </header>
  );
}
