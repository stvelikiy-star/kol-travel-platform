import Link from "next/link";
import { MobileNav } from "@/components/layout/MobileNav";
import { Container } from "@/components/ui/Container";
import { cn } from "@/lib/cn";

const publicLinks = [
  { label: "Главная", href: "/" },
  { label: "Проживание", href: "/stays" },
  { label: "Туры и отдых", href: "/tours" },
  { label: "Доставка", href: "/delivery" },
  { label: "Трансфер", href: "/transfer" },
  { label: "Ещё", href: "/contacts" }
];

type PublicHeaderProps = { className?: string };

export function PublicHeader({ className }: PublicHeaderProps) {
  return (
    <header className={cn("sticky top-0 z-30 border-b border-border/80 bg-surface/90 shadow-sm backdrop-blur-xl", className)}>
      <Container className="relative flex min-h-16 items-center justify-between gap-3 py-2 sm:min-h-20 sm:gap-4 sm:py-0">
        <Link className="flex min-w-0 flex-col rounded-xl px-1 transition hover:text-primary" href="/">
          <span className="text-xl font-semibold tracking-normal text-primary sm:text-2xl">KÖL</span>
          <span className="max-w-[12rem] truncate text-xs font-medium text-muted sm:max-w-none">Issyk-Kul Travel & Delivery</span>
        </Link>

        <nav className="hidden items-center gap-5 lg:flex">
          {publicLinks.map((link) => (
            <Link className="rounded-xl px-3 py-2 text-sm font-semibold text-muted transition hover:bg-[#E9F8F7] hover:text-primary" href={link.href} key={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-primary bg-primary px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_40px_rgba(7,28,44,0.08)] transition hover:bg-[#063B57] hover:shadow-[0_12px_40px_rgba(7,28,44,0.12)]" href="/checkout">
            Найти и заказать
          </Link>
        </div>
        <MobileNav />
      </Container>
    </header>
  );
}
