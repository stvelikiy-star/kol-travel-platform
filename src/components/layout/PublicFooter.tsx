import { Badge } from "@/components/ui/Badge";
import { Container } from "@/components/ui/Container";
import { cn } from "@/lib/cn";

const footerLinks = [
  { label: "Туры", href: "/tours" },
  { label: "Жильё", href: "/stays" },
  { label: "Еда", href: "/food" },
  { label: "Магазин", href: "/shop" },
  { label: "Партнёрам", href: "/partners" },
  { label: "О нас", href: "/" },
  { label: "Контакты", href: "/contacts" }
];

type PublicFooterProps = {
  className?: string;
};

export function PublicFooter({ className }: PublicFooterProps) {
  return (
    <footer className={cn("border-t border-border/80 bg-lake-dark py-12 text-white", className)}>
      <Container className="grid gap-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="space-y-4">
          <div>
            <p className="text-2xl font-semibold text-aqua">KÖL</p>
            <p className="text-sm font-medium text-white/70">Issyk-Kul Travel & Delivery</p>
          </div>
          <p className="max-w-md text-sm leading-6 text-white/70">
            Платформа для туров, жилья, доставки еды, магазина и партнёрских инструментов вокруг Иссык-Куля.
          </p>
          <Badge variant="warning">Alcohol module OFF by default until legal approval</Badge>
        </div>

        <nav className="grid gap-1 text-sm">
          {footerLinks.map((link) => (
            <a className="flex min-h-10 items-center rounded-md font-medium text-white/70 transition hover:text-aqua" href={link.href} key={link.href}>
              {link.label}
            </a>
          ))}
        </nav>

        <div className="space-y-2 text-sm text-white/70">
          <p className="font-semibold text-white">Контакты</p>
          <p>Телефон: скоро</p>
          <p>Telegram: скоро</p>
          <p>WhatsApp: скоро</p>
          <p className="pt-4">© 2026 KÖL. All rights reserved.</p>
        </div>
      </Container>
    </footer>
  );
}
