import type { ReactNode } from "react";
import { PartnerLayout } from "@/components/layout/PartnerLayout";
import { PartnerCatalogStopRulesPanel } from "@/app/partner/catalog/_components/PartnerCatalogStopRulesPanel";
import { PartnerStopScopeCard } from "@/components/partner/PartnerStopScopeCard";
import { PartnerWarningCard } from "@/components/partner/PartnerWarningCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { getProductById, getProducts } from "@/lib/data/catalog";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export function generateStaticParams() {
  return getProducts().map((product) => ({ id: product.id }));
}

export default async function PartnerProductDetailPage({ params }: PageProps) {
  const { id } = await params;
  const product = getProductById(id);

  if (!product) {
    return <NotFoundState />;
  }

  return (
    <PartnerLayout>
      <Breadcrumb current="Detail" />
      <PartnerCatalogStopRulesPanel context="product" />

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Badge variant="info">product</Badge>
                  <CardTitle className="mt-3 text-2xl">Управление товаром</CardTitle>
                  <CardDescription>{product.id}</CardDescription>
                </div>
                <Badge variant={product.status === "active" ? "success" : "warning"}>{product.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-lg font-semibold text-foreground">{product.title}</p>
              <p className="text-sm leading-6 text-muted">{product.description}</p>
              <div className="grid gap-3 md:grid-cols-4">
                <Info label="Price" value={`${product.price} ${product.currency}`} />
                <Info label="Category" value={product.category} />
                <Info label="Stock demo" value="24 units" />
                <Info label="Delivery availability demo" value="available for delivery" />
              </div>
            </CardContent>
          </Card>

          <PartnerWarningCard
            description="Stopping product blocks new orders only. Existing accepted orders are not changed."
            items={[
              "Product is blocked in new checkout",
              "Accepted orders continue",
              "Product is not deleted",
              "Payment status is not changed"
            ]}
            title="Stop rule for product"
            tone="warning"
          />
        </div>

        <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
          <Card>
            <CardHeader>
              <CardTitle>Shop controls demo</CardTitle>
              <CardDescription>UI-only controls for future product CRM.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Info label="Business" value={product.businessId} />
              <Info label="Public visibility demo" value="visible in shop catalog" />
              <Info label="Order status demo" value="open for new orders" />
            </CardContent>
            <CardFooter>
              <Button>Edit demo</Button>
              <StyledLink href="/shop/sary-oi-market">Preview public page demo</StyledLink>
              <StyledLink href="/partner/catalog">Back to catalog</StyledLink>
            </CardFooter>
          </Card>

          <PartnerStopScopeCard
            affectedArea={product.title}
            description="Pause or stop new orders for this product scope."
            safetyNote="Stopping product blocks new orders only. Existing accepted orders are not changed."
            scopeType="product"
            status="active"
            title="Product stop scope"
          />
        </aside>
      </section>
    </PartnerLayout>
  );
}

function Breadcrumb({ current }: { current: string }) {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-2 p-4 text-sm font-medium text-muted">
        <StyledLink href="/partner">Partner</StyledLink>
        <span>/</span>
        <StyledLink href="/partner/catalog">Catalog</StyledLink>
        <span>/</span>
        <span>Products</span>
        <span>/</span>
        <span className="text-foreground">{current}</span>
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="font-semibold text-foreground">{value}</p>
    </div>
  );
}

function StyledLink({ children, href }: { children: ReactNode; href: string }) {
  return (
    <a className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:border-primary hover:text-primary" href={href}>
      {children}
    </a>
  );
}

function NotFoundState() {
  return (
    <PartnerLayout>
      <Card>
        <CardHeader>
          <Badge className="w-fit" variant="warning">Not found</Badge>
          <CardTitle>Товар не найден</CardTitle>
          <CardDescription>В mockProducts нет товара с таким ID.</CardDescription>
        </CardHeader>
        <CardFooter>
          <StyledLink href="/partner/catalog">Back to catalog</StyledLink>
        </CardFooter>
      </Card>
    </PartnerLayout>
  );
}
