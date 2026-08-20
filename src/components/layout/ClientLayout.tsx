"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { cn } from "@/lib/cn";

const navItems = [
  { label: "Обзор", href: "/client" },
  { label: "Мои заказы", href: "/client/orders" },
  { label: "Мои брони", href: "/client/bookings" },
  { label: "Баллы", href: "/client/loyalty" },
  { label: "Офферы", href: "/client/offers" },
  { label: "Избранное", href: "/client/favorites" },
  { label: "Профиль", href: "/client/profile" },
  { label: "Поддержка", href: "/client/support" }
];

type ClientLayoutProps = {
  children: ReactNode;
  className?: string;
};

export function ClientLayout({ children, className }: ClientLayoutProps) {
  const pathname = usePathname();

  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-lake-light/45 to-sand-light/60">
      <div className="border-b border-border/80 bg-surface/90 shadow-sm backdrop-blur-xl">
        <Container className="flex min-h-20 flex-wrap items-center justify-between gap-4 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">KÖL client cabinet</p>
            <h1 className="text-2xl font-semibold leading-tight text-foreground">Кабинет клиента</h1>
          </div>
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:border-primary hover:bg-lake-light hover:text-primary"
            href="/"
          >
            На главную
          </Link>
        </Container>
      </div>

      <Container className={cn("grid gap-6 py-6 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)]", className)}>
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card className="overflow-hidden shadow-soft">
            <div className="bg-gradient-to-br from-lake-dark via-primary to-sand p-5 text-white">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 text-lg font-semibold">
                DC
              </div>
              <div className="mt-4">
                <p className="text-lg font-semibold">Demo Client</p>
                <p className="text-sm text-white/80">client@example.com</p>
              </div>
            </div>
            <CardContent className="space-y-3 p-4">
              <div className="grid grid-cols-2 gap-2">
                <Metric label="Баллы" value="1 240" />
                <Metric label="Скидки" value="4" />
              </div>
              <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm font-medium text-foreground">
                Demo cabinet без авторизации
              </div>
            </CardContent>
          </Card>

          <Card className="hidden lg:block shadow-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base">Навигация</CardTitle>
                <Badge variant="info">demo</Badge>
              </div>
            </CardHeader>
            <CardContent className="grid gap-1">
              {navItems.map((item) => (
                <DashboardLink
                  active={isActive(pathname, item.href)}
                  href={item.href}
                  key={item.href}
                  label={item.label}
                />
              ))}
            </CardContent>
          </Card>
        </aside>

        <section className="min-w-0 space-y-6 overflow-hidden">
          <Card className="lg:hidden shadow-card">
            <CardContent className="mobile-scroll flex gap-2 overflow-x-auto p-3">
              {navItems.map((item) => (
                <DashboardLink
                  active={isActive(pathname, item.href)}
                  href={item.href}
                  key={item.href}
                  label={item.label}
                />
              ))}
            </CardContent>
          </Card>

          <div className="min-w-0 overflow-hidden rounded-xl border border-border/90 bg-surface/80 p-3 shadow-card backdrop-blur sm:p-5">
            <div className="space-y-6">{children}</div>
          </div>
        </section>
      </Container>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/80 bg-background/80 p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-lg font-semibold text-primary">{value}</p>
    </div>
  );
}

function isActive(pathname: string, href: string) {
  if (href === "/client") {
    return pathname === href;
  }

  return pathname.startsWith(href);
}

function DashboardLink({ active, href, label }: { active: boolean; href: string; label: string }) {
  return (
    <a
      className={cn(
        "inline-flex min-h-11 max-w-full shrink-0 whitespace-nowrap items-center rounded-md px-3 py-2 text-sm font-semibold transition",
        active
          ? "bg-primary text-white shadow-[0_8px_20px_rgba(15,143,140,0.22)]"
          : "text-muted hover:bg-lake-light hover:text-primary"
      )}
      href={href}
    >
      {label}
    </a>
  );
}
