import type { ReactNode } from "react";
import { PartnerLayout } from "@/components/layout/PartnerLayout";
import { PartnerCatalogStopRulesPanel } from "@/app/partner/catalog/_components/PartnerCatalogStopRulesPanel";
import { PartnerStopScopeCard } from "@/components/partner/PartnerStopScopeCard";
import { PartnerWarningCard } from "@/components/partner/PartnerWarningCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { getFood, getFoodById } from "@/lib/data/catalog";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export function generateStaticParams() {
  return getFood().map((food) => ({ id: food.id }));
}

export default async function PartnerFoodDetailPage({ params }: PageProps) {
  const { id } = await params;
  const food = getFoodById(id);

  if (!food) {
    return <NotFoundState />;
  }

  return (
    <PartnerLayout>
      <Breadcrumb current="Detail" />
      <PartnerCatalogStopRulesPanel context="food" />

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Badge variant="info">food item</Badge>
                  <CardTitle className="mt-3 text-2xl">Управление блюдом / меню</CardTitle>
                  <CardDescription>{food.id}</CardDescription>
                </div>
                <Badge variant={food.status === "active" ? "success" : "warning"}>{food.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-lg font-semibold text-foreground">{food.title}</p>
              <p className="text-sm leading-6 text-muted">{food.description}</p>
              <div className="grid gap-3 md:grid-cols-4">
                <Info label="Price" value={`${food.price} ${food.currency}`} />
                <Info label="Category" value={food.category} />
                <Info label="Preparation time demo" value="20-35 min" />
                <Info label="Availability demo" value={food.status === "active" ? "available" : food.status} />
              </div>
            </CardContent>
          </Card>

          <PartnerWarningCard
            description="Stopping food item hides it from new orders only. Existing accepted orders are not changed."
            items={[
              "Food item is hidden from new checkout",
              "Accepted orders continue",
              "Item is not deleted",
              "Refund/cancel flows require separate admin rules"
            ]}
            title="Stop rule for food item"
            tone="warning"
          />
        </div>

        <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
          <Card>
            <CardHeader>
              <CardTitle>Menu controls demo</CardTitle>
              <CardDescription>UI-only controls for future menu CRM.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Info label="Business" value={food.businessId} />
              <Info label="Public visibility demo" value="visible in restaurant menu" />
              <Info label="Order status demo" value="open for new orders" />
            </CardContent>
            <CardFooter>
              <Button>Edit demo</Button>
              <StyledLink href="/food/naryn-beshbarmak">Preview public page demo</StyledLink>
              <StyledLink href="/partner/catalog">Back to catalog</StyledLink>
            </CardFooter>
          </Card>

          <PartnerStopScopeCard
            affectedArea={food.title}
            description="Pause or stop new orders for this food item scope."
            safetyNote="Stopping food item hides it from new orders only. Existing accepted orders are not changed."
            scopeType="food_item"
            status="active"
            title="Food item stop scope"
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
        <span>Food</span>
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
          <CardTitle>Блюдо не найдено</CardTitle>
          <CardDescription>В mockFood нет позиции с таким ID.</CardDescription>
        </CardHeader>
        <CardFooter>
          <StyledLink href="/partner/catalog">Back to catalog</StyledLink>
        </CardFooter>
      </Card>
    </PartnerLayout>
  );
}
