import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { cn } from "@/lib/cn";

const travelLinks = [
  { label: "Проживание", href: "/stays" },
  { label: "Туры и отдых", href: "/tours" },
  { label: "Доставка", href: "/delivery" },
  { label: "Трансфер", href: "/transfer" }
];

const serviceLinks = [
  { label: "Помощь и контакты", href: "/contacts" },
  { label: "Для бизнеса", href: "/partners" },
  { label: "Фотографии и лицензии", href: "/photo-credits" },
  { label: "Вход для команды", href: "/team" }
];

type PublicFooterProps = {
  className?: string;
};

export function PublicFooter({ className }: PublicFooterProps) {
  return (
    <footer className={cn("border-t border-border/80 bg-lake-dark py-10 text-white", className)}>
      <Container className="grid gap-8 md:grid-cols-2 lg:grid-cols-[1.4fr_0.8fr_0.8fr]">
        <div className="space-y-3 md:col-span-2 lg:col-span-1">
          <div>
            <Image alt="KÖL — Всё рядом" className="h-auto w-[132px] rounded-lg bg-white px-2 py-1" height={76} src="/media/kol/kol-logo.jpg" width={300} />
            <p className="text-sm font-medium text-white/70">Иссык-Куль · Ысык-Көл</p>
          </div>
          <p className="max-w-md text-sm leading-6 text-white/70">
            Проживание, туры и отдых, доставка и трансфер — основные сервисы для поездки на Иссык-Куль.
          </p>
          <p className="pt-2 text-xs text-white/50">© 2026 KÖL. Все права защищены.</p>
        </div>

        <nav className="grid content-start gap-1 text-sm" aria-label="Разделы для отдыха">
          <p className="mb-2 font-semibold text-white">Для отдыха</p>
          {travelLinks.map((link) => (
            <Link className="flex min-h-9 items-center font-medium text-white/70 transition hover:text-aqua" href={link.href} key={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>

        <nav className="grid content-start gap-1 text-sm" aria-label="Сервис KÖL">
          <p className="mb-2 font-semibold text-white">KÖL</p>
          {serviceLinks.map((link) => (
            <Link
              className={cn(
                "flex min-h-9 items-center font-medium transition hover:text-aqua",
                link.href === "/team" ? "mt-2 border-t border-white/10 pt-3 text-white/50" : "text-white/70"
              )}
              href={link.href}
              key={link.href}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </Container>
    </footer>
  );
}
