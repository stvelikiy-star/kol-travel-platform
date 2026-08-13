import type { ReactNode } from "react";
import { PartnerLayout } from "@/components/layout/PartnerLayout";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

const activePromos = [
  {
    title: "Сезонный ужин у озера",
    category: "Еда",
    discount: "15%",
    period: "01.07 - 20.07",
    uses: "42 / 100"
  },
  {
    title: "Катер + обед",
    category: "Туры",
    discount: "10%",
    period: "05.07 - 31.07",
    uses: "18 / 60"
  }
];

const expiredPromos = [
  {
    title: "Раннее бронирование",
    category: "Жильё",
    discount: "12%",
    period: "01.06 - 20.06",
    uses: "73"
  },
  {
    title: "Доставка без комиссии",
    category: "Магазин",
    discount: "500 KGS",
    period: "10.06 - 18.06",
    uses: "25"
  }
];

export default function PartnerPromosPage() {
  return (
    <PartnerLayout>
      <section className="space-y-6">
        <div className="rounded-lg border border-primary/20 bg-primary/10 p-5">
          <Badge variant="info">Demo mode</Badge>
          <h2 className="mt-3 text-2xl font-semibold text-foreground">Промо и скидки</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            Управление промо пока работает как UI-demo. Реальные правила применения,
            лимиты и аналитика будут подключены позже.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Активные промо" value="2" tone="success" />
          <StatCard label="Завершённые" value="2" tone="muted" />
          <StatCard label="Использований demo" value="158" tone="info" />
          <StatCard label="Средняя скидка" value="12%" tone="warning" />
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle>Активные промо</CardTitle>
                <CardDescription>Промо, которые видны клиентам в demo-режиме.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                {activePromos.map((promo) => (
                  <PromoCard key={promo.title} promo={promo} status="active" />
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Завершённые промо</CardTitle>
                <CardDescription>История кампаний без реального списания скидок.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                {expiredPromos.map((promo) => (
                  <PromoCard key={promo.title} promo={promo} status="expired" />
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Создать промо demo</CardTitle>
              <CardDescription>Форма не отправляет данные и не меняет цены.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Название">
                <Input placeholder="Например: Скидка на ужин" />
              </Field>
              <Field label="Категория">
                <Select defaultValue="food">
                  <option value="food">Еда</option>
                  <option value="tour">Туры</option>
                  <option value="stay">Жильё</option>
                  <option value="shop">Магазин</option>
                </Select>
              </Field>
              <Field label="Скидка">
                <Input placeholder="10%" />
              </Field>
              <Field label="Даты">
                <Input placeholder="01.07 - 31.07" />
              </Field>
              <Field label="Лимит использований">
                <Input placeholder="100" />
              </Field>
            </CardContent>
            <CardFooter>
              <Button className="w-full">Создать demo</Button>
            </CardFooter>
          </Card>
        </div>
      </section>
    </PartnerLayout>
  );
}

function StatCard({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: "success" | "warning" | "info" | "muted";
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <Badge variant={tone}>{label}</Badge>
        <p className="mt-4 text-3xl font-semibold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

function PromoCard({
  promo,
  status
}: {
  promo: { title: string; category: string; discount: string; period: string; uses: string };
  status: "active" | "expired";
}) {
  return (
    <Card className="bg-background/70">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge variant={status === "active" ? "success" : "muted"}>
            {status === "active" ? "active" : "expired"}
          </Badge>
          <Badge variant="info">{promo.category}</Badge>
        </div>
        <CardTitle className="text-base">{promo.title}</CardTitle>
        <CardDescription>{promo.period}</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-md border border-border bg-surface p-3">
          <p className="text-muted">Скидка</p>
          <p className="font-semibold text-primary">{promo.discount}</p>
        </div>
        <div className="rounded-md border border-border bg-surface p-3">
          <p className="text-muted">Использования</p>
          <p className="font-semibold text-foreground">{promo.uses}</p>
        </div>
      </CardContent>
      <CardFooter>
        <Button variant="outline">Редактировать demo</Button>
        <Button variant="ghost">Остановить demo</Button>
      </CardFooter>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-foreground">
      {label}
      {children}
    </label>
  );
}
