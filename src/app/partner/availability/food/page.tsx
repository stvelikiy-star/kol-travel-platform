import type { ReactNode } from "react";
import { PartnerLayout } from "@/components/layout/PartnerLayout";
import { PartnerAvailabilityRulesPanel } from "@/app/partner/availability/_components/PartnerAvailabilityRulesPanel";
import { PartnerAvailabilityCalendarCard } from "@/components/partner/PartnerAvailabilityCalendarCard";
import { PartnerAvailabilityRuleCard } from "@/components/partner/PartnerAvailabilityRuleCard";
import { PartnerStopScopeCard } from "@/components/partner/PartnerStopScopeCard";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { getFood } from "@/lib/data/catalog";

const workingHours = [
  { date: "Пн-Пт", label: "09:00 - 22:00 · кухня и доставка активны", status: "available" as const },
  { date: "Сб", label: "10:00 - 23:00 · ограниченная смена", status: "limited" as const },
  { date: "Вс", label: "11:00 - 20:00 · demo schedule", status: "available" as const }
];

export default function PartnerFoodAvailabilityPage() {
  const foodItems = getFood();
  const readyForPickup = foodItems.filter((item) => item.status === "active").length;
  const stoppedItems = foodItems.filter((item) => ["stopped", "hidden", "out_of_stock"].includes(item.status)).length;

  return (
    <PartnerLayout>
      <PartnerAvailabilityRulesPanel context="food" />

      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-secondary via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">Food availability</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Доступность еды и меню</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
            Demo управление рабочими часами, доступностью блюд и stop-scope для меню.
          </p>
        </div>
      </Card>

      <Card className="border-warning/40 bg-warning/10">
        <CardContent className="p-4 text-sm font-medium text-foreground">
          Demo cabinet без backend. Остановка блюда скрывает его только от новых заказов; принятые заказы не отменяются.
        </CardContent>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Активные блюда" value={foodItems.filter((item) => item.status === "active").length} />
        <StatCard label="Остановленные позиции" value={stoppedItems} />
        <StatCard label="Рабочие часы" value="7/7" />
        <StatCard label="Готовы к выдаче" value={readyForPickup} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <PartnerAvailabilityCalendarCard
            dates={workingHours}
            note="Partner can pause delivery/preparation for new orders. Accepted orders are not cancelled."
            title="Working hours demo"
            type="restaurant"
          />

          <PartnerAvailabilityCalendarCard
            dates={foodItems.map((item) => ({
              date: item.category,
              label: `${item.title} · ${item.price} ${item.currency}`,
              status: item.status === "active" ? "available" : item.status === "out_of_stock" ? "limited" : "stopped"
            }))}
            note="Stopped dish hides only from new orders. Existing accepted orders are not changed."
            title="Menu item availability"
            type="restaurant"
          />
        </div>

        <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
          <PartnerAvailabilityRuleCard
            rules={[
              "stopped dish hides only from new orders",
              "partner can pause delivery/preparation",
              "accepted orders are not cancelled"
            ]}
            title="Food availability rules"
            warning="Food availability must be checked again during checkout before an order is created."
          />
          <PartnerStopScopeCard
            affectedArea="Demo food item scope"
            description="Pause or stop new orders for a selected menu item."
            safetyNote="Stopping food item affects only new orders and does not cancel accepted orders."
            scopeType="food_item"
            status="active"
            title="Food item stop scope demo"
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
        <Badge variant="muted">food demo</Badge>
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
