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
  { label: "Собственник", href: "/owner" },
  { label: "Корзина", href: "/cart" }
];

type PublicHeaderProps = {
  className?: string;
};

export function PublicHeader({ className }: PublicHeaderProps) {
  return (
    <header className={cn("sticky top-0 z-30 border-b border-border/80 bg-surface/90 shadow-sm backdrop-blur-xl", className)}>
      <Container className="relative flex min-h-16 items-center justify-between gap-3 py-2 sm:min-h-20 sm:gap-4 sm:py-0">
        <Link className="flex min-w-0 flex-col rounded-md px-1 transition hover:text-primary" href="/">
          <span className="text-xl font-semibold tracking-normal text-primary sm:text-2xl">KÖL</span>
          <span className="max-w-[12rem] truncate text-xs font-medium text-muted sm:max-w-none">Иссык-Куль · Ысык-Көл</span>
        </Link>

        <nav className="hidden items-center gap-3 xl:flex">
          {publicLinks.map((link) => (
            <Link
              className="rounded-md px-2 py-2 text-sm font-semibold text-muted transition hover:bg-lake-light hover:text-primary"
              href={link.href}
              key={link.href}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-transparent bg-transparent px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-lake-light hover:text-primary"
            href="/client"
          >
            Войти
          </Link>
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-primary bg-primary px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(15,143,140,0.22)] transition hover:shadow-[0_10px_24px_rgba(15,143,140,0.28)]"
            href="/partner"
          >
            Кабинет партнёра
          </Link>
        </div>

        <MobileNav />
      </Container>
    </header>
  );
}
