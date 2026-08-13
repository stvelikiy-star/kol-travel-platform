import type { ReactNode } from "react";
import { PartnerLayout } from "@/components/layout/PartnerLayout";
import { PartnerAvailabilityRulesPanel } from "@/app/partner/availability/_components/PartnerAvailabilityRulesPanel";
import { PartnerAvailabilityCalendarCard } from "@/components/partner/PartnerAvailabilityCalendarCard";
import { PartnerAvailabilityRuleCard } from "@/components/partner/PartnerAvailabilityRuleCard";
import { PartnerStopScopeCard } from "@/components/partner/PartnerStopScopeCard";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { getProducts } from "@/lib/data/catalog";

export default function PartnerProductsAvailabilityPage() {
  const products = getProducts();
  const stockDemo = products.map((product, index) => ({
    ...product,
    stock: index === 0 ? 48 : index === 1 ? 12 : index === 2 ? 5 : index === 3 ? 0 : 18
  }));
  const inStock = stockDemo.filter((product) => product.status === "active" && product.stock > 5).length;
  const limited = stockDemo.filter((product) => product.status === "active" && product.stock > 0 && product.stock <= 5).length;
  const outOfStock = stockDemo.filter((product) => product.stock === 0 || product.status === "out_of_stock").length;

  return (
    <PartnerLayout>
      <PartnerAvailabilityRulesPanel context="products" />

      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-secondary via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">Product availability</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Доступность товаров</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
            Demo управление наличием товаров, stock-состояниями и stop-scope для магазина.
          </p>
        </div>
      </Card>

      <Card className="border-warning/40 bg-warning/10">
        <CardContent className="p-4 text-sm font-medium text-foreground">
          Demo cabinet без backend. Остановка товара блокирует только новые заказы; принятые заказы не меняются.
        </CardContent>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="В наличии" value={inStock} />
        <StatCard label="Ограничено" value={limited} />
        <StatCard label="Нет в наличии" value={outOfStock} />
        <StatCard label="Ожидают поставку" value="demo" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <PartnerAvailabilityCalendarCard
            dates={stockDemo.map((product) => ({
              date: product.category,
              label: `${product.title} · stock demo: ${product.stock} · ${product.price} ${product.currency}`,
              status:
                product.status !== "active"
                  ? "stopped"
                  : product.stock === 0
                    ? "closed"
                    : product.stock <= 5
                      ? "limited"
                      : "available"
            }))}
            note="Stopped product blocks only new orders. Existing accepted orders are not changed."
            title="Product stock demo"
            type="product"
          />
        </div>

        <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
          <PartnerAvailabilityRuleCard
            rules={[
              "stopped product blocks only new orders",
              "accepted orders are not changed",
              "real stock will be connected later"
            ]}
            title="Product availability rules"
            warning="Real stock and reservation checks will run during checkout in later stages."
          />
          <PartnerStopScopeCard
            affectedArea="Demo product scope"
            description="Pause or stop new orders for a selected product."
            safetyNote="Stopping product affects only new orders and does not change accepted orders."
            scopeType="product"
            status="active"
            title="Product stop scope demo"
          />
          <BackLink href="/partner/availability">Назад к доступности</BackLink>
        </aside>
      </section>
    </PartnerLayout>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <p className="text-sm font-medium text-muted">{label}</p>
        <p className="text-3xl font-semibold text-primary">{value}</p>
        <Badge variant="muted">products demo</Badge>
      </CardContent>
    </Card>
  );
}

function BackLink({ children, href }: { children: ReactNode; href: string }) {
  return (
    <a className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:border-primary hover:text-primary" href={href}>
      {children}
    </a>
  );
}
