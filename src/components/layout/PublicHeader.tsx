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
    <span aria-label="КӨЛ — ВСЁ РЯДОМ" className="inline-flex min-w-[9.5rem] flex-col items-center leading-none sm:min-w-[11.5rem]" role="img">
      <span className="flex items-center text-[1.8rem] font-black tracking-[-0.08em] text-[#062640] sm:text-[2.25rem]">
        <span>К</span>
        <svg aria-hidden="true" className="mx-[0.04em] h-[1.12em] w-[1.12em] overflow-visible" viewBox="0 0 100 112">
          <defs><linearGradient id="kolMarkGradient" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#08b7bd"/><stop offset=".62" stopColor="#078aa8"/><stop offset="1" stopColor="#075b8f"/></linearGradient></defs>
          <circle cx="38" cy="8" r="7" fill="#08aeb8"/><circle cx="62" cy="8" r="7" fill="#08aeb8"/>
          <circle cx="50" cy="60" r="42" fill="url(#kolMarkGradient)"/>
          <path d="M25 62 43 43l10 11 9-9 16 17" fill="none" stroke="white" strokeWidth="8" strokeLinejoin="round"/>
          <path d="M14 72c16-12 27-7 38-1 12 7 21 7 35-4-5 20-19 33-38 34-18 0-31-10-35-29Z" fill="#18d1cc"/>
          <path d="M17 80c14-7 25-5 36 1 10 5 19 6 30 0-7 13-19 20-34 20-14 0-25-7-32-21Z" fill="#075b8f"/>
        </svg>
        <span>Л</span>
      </span>
      <span className="mt-1 pl-[.32em] text-[0.5rem] font-bold uppercase tracking-[0.42em] text-[#062640] sm:text-[0.58rem]">ВСЁ РЯДОМ</span>
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
            <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="M8 14h3M8 17h6"/></svg> Собрать поездку
          </Link>
        </div>
        <MobileNav />
      </Container>
    </header>
  );
}
