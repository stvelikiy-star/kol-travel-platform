"use client";

import { useState } from "react";
import type { ProductStatus } from "@/types";
import { EmptyState } from "@/components/catalog/EmptyState";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { Input } from "@/components/ui/Input";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { mockFood } from "@/data/mockFood";
import { mockPartners } from "@/data/mockPartners";
import { mockProducts } from "@/data/mockProducts";

type CheckoutLine = {
  id: string;
  title: string;
  partnerName: string;
  group: "Ресторан / кафе" | "Магазин";
  quantity: number;
  price: number;
  currency: "KGS";
  status: ProductStatus;
};

const statusVariants: Record<ProductStatus, BadgeVariant> = {
  active: "success",
  out_of_stock: "warning",
  hidden: "muted",
  stopped: "danger",
  under_review: "info"
};

const locations = ["Чолпон-Ата", "Бостери", "Каракол", "Тамчы", "Бактуу-Долоноту", "Сары-Ой"];

function getPartnerName(businessId: string) {
  return mockPartners.find((partner) => partner.id === businessId)?.title ?? "KÖL Partner";
}

const checkoutItems: CheckoutLine[] = [
  ...mockFood.slice(0, 2).map((item, index) => ({
    id: item.id,
    title: item.title,
    partnerName: getPartnerName(item.businessId),
    group: "Ресторан / кафе" as const,
    quantity: index + 1,
    price: item.price,
    currency: item.currency,
    status: item.status
  })),
  ...mockProducts.slice(0, 2).map((item, index) => ({
    id: item.id,
    title: item.title,
    partnerName: getPartnerName(item.businessId),
    group: "Магазин" as const,
    quantity: index + 2,
    price: item.price,
    currency: item.currency,
    status: item.status
  }))
];

const subtotal = checkoutItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
const deliveryFee = 150;
const discount = 0;
const points = 0;
const total = subtotal + deliveryFee - discount - points;
const isEmpty = checkoutItems.length === 0;

function StepIndicator() {
  const steps = ["Корзина", "Оформление", "Подтверждение"];

  return (
    <div className="grid gap-3 rounded-lg border border-border/90 bg-surface/90 p-4 shadow-card backdrop-blur sm:grid-cols-3">
      {steps.map((step, index) => {
        const isCurrent = step === "Оформление";

        return (
          <div
            className={isCurrent ? "rounded-md bg-primary p-3 text-white shadow-sm" : "rounded-md border border-border/80 bg-background p-3"}
            key={step}
          >
            <p className="text-xs font-semibold uppercase tracking-wide">Шаг {index + 1}</p>
            <p className="mt-1 text-sm font-semibold">{step}</p>
          </div>
        );
      })}
    </div>
  );
}

export default function CheckoutPage() {
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<"delivery" | "pickup">("delivery");
  const [paymentMethod, setPaymentMethod] = useState("cod");

  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <Container className="space-y-8 py-10">
        <SectionTitle
          description="Проверьте контакты, адрес доставки, способ оплаты и итоговую сумму."
          eyebrow="Checkout demo"
          title="Оформление заказа"
        />

        {isEmpty ? (
          <Card>
            <CardContent className="grid gap-4 p-6">
              <EmptyState
                actionLabel="Еда"
                description="Вернитесь в каталог еды или магазин и добавьте позиции."
                href="/food"
                title="Нет товаров для оформления"
              />
              <a
                className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:border-primary hover:text-primary sm:w-auto"
                href="/shop"
              >
                Магазин
              </a>
            </CardContent>
          </Card>
        ) : (
          <>
            <StepIndicator />

            <Card className="border-warning/40 bg-warning/10">
              <CardContent className="p-5 text-sm font-medium leading-6 text-foreground">
                Это demo checkout. Реальное создание заказа, оплата и уведомления будут подключены
                на следующих этапах.
              </CardContent>
            </Card>

            {isConfirmed ? (
              <Card className="border-success">
                <CardContent className="grid gap-3 p-5 text-sm font-semibold text-success">
                  <p>Заказ создан в demo mode. Реальная отправка будет подключена позже.</p>
                  <a
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-success bg-surface px-4 py-2 text-sm font-semibold text-success shadow-sm transition hover:opacity-90 sm:w-auto"
                    href="/order/success"
                  >
                    Открыть demo confirmation
                  </a>
                </CardContent>
              </Card>
            ) : null}

            <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Контакты</CardTitle>
                    <CardDescription>Поля со звёздочкой обязательны для будущей валидации.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">Имя *</label>
                      <Input placeholder="Ваше имя" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">Телефон *</label>
                      <Input className="border-danger" placeholder="+996" />
                      <p className="text-xs text-danger">Пример error state: телефон обязателен.</p>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm font-semibold">Email, опционально</label>
                      <Input placeholder="name@example.com" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Способ получения</CardTitle>
                    <CardDescription>
                      Корзина может содержать группы: ресторан / кафе и магазин. Доставка считается
                      отдельно по партнёрам.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 sm:grid-cols-2">
                    {[
                      { value: "delivery", label: "Доставка" },
                      { value: "pickup", label: "Самовывоз" }
                    ].map((method) => (
                      <label
                        className={
                          deliveryMethod === method.value
                            ? "rounded-lg border border-primary bg-lake-light p-4 shadow-sm"
                            : "rounded-lg border border-border bg-surface p-4 transition hover:border-primary/50"
                        }
                        key={method.value}
                      >
                        <input
                          checked={deliveryMethod === method.value}
                          className="sr-only"
                          name="delivery-method"
                          onChange={() => setDeliveryMethod(method.value as "delivery" | "pickup")}
                          type="radio"
                        />
                        <span className="font-semibold">{method.label}</span>
                      </label>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Адрес доставки</CardTitle>
                    <CardDescription>Выберите населённый пункт и добавьте ориентир для курьера.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">Локация / населённый пункт *</label>
                      <Select defaultValue="">
                        <option value="" disabled>
                          Выберите локацию
                        </option>
                        {locations.map((location) => (
                          <option key={location} value={location}>
                            {location}
                          </option>
                        ))}
                      </Select>
                      <p className="text-xs text-warning">Warning: адрес ещё не выбран.</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">Адрес *</label>
                      <Input placeholder="Улица, дом, корпус" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">Ориентир</label>
                      <Input placeholder="Рядом с пляжем / отелем" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">Комментарий курьеру</label>
                      <Textarea placeholder="Позвонить за 10 минут" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Оплата</CardTitle>
                    <CardDescription>
                      Онлайн-платежи будут подключены на следующих этапах после юридической и
                      платёжной настройки.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-2">
                    {[
                      { value: "cod", label: "Оплата при получении", disabled: false },
                      { value: "transfer", label: "Перевод", disabled: false },
                      { value: "cash", label: "Наличными", disabled: false },
                      { value: "online", label: "Онлайн оплата — soon", disabled: true }
                    ].map((method) => (
                      <label
                        className={
                          method.disabled
                            ? "rounded-lg border border-border bg-background p-4 opacity-60"
                            : paymentMethod === method.value
                              ? "rounded-lg border border-primary bg-background p-4"
                              : "rounded-lg border border-border bg-surface p-4"
                        }
                        key={method.value}
                      >
                        <input
                          checked={paymentMethod === method.value}
                          className="mr-2"
                          disabled={method.disabled}
                          name="payment-method"
                          onChange={() => setPaymentMethod(method.value)}
                          type="radio"
                        />
                        <span className="font-semibold">{method.label}</span>
                      </label>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Промокод и баллы</CardTitle>
                    <CardDescription>
                      Промокод не применяется реально, баллы не списываются реально.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-[1fr_auto]">
                    <Input placeholder="Промокод" />
                    <Button variant="outline">Применить</Button>
                    <label className="flex items-center gap-3 rounded-lg border border-border bg-background p-4 md:col-span-2">
                      <input type="checkbox" />
                      <span className="text-sm font-semibold">Использовать баллы, demo state</span>
                    </label>
                  </CardContent>
                </Card>
              </div>

              <Card className="lg:sticky lg:top-24">
                <CardHeader>
                  <CardTitle>Order summary</CardTitle>
                  <CardDescription>Итоговая сумма и выбранные demo-настройки.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    {checkoutItems.map((item) => (
                      <div className="rounded-md bg-background p-3 text-sm" key={item.id}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">{item.title}</p>
                            <p className="text-muted">
                              {item.group} · {item.partnerName}
                            </p>
                          </div>
                          <Badge variant={statusVariants[item.status]}>{item.status}</Badge>
                        </div>
                        <p className="mt-2 text-muted">
                          {item.quantity} × {item.price} {item.currency}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-3 rounded-md bg-background p-4 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted">Subtotal</span>
                      <span className="font-semibold">{subtotal} KGS</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted">Delivery placeholder</span>
                      <span className="font-semibold">{deliveryFee} KGS</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted">Discount placeholder</span>
                      <span className="font-semibold">-{discount} KGS</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted">Points placeholder</span>
                      <span className="font-semibold">-{points} KGS</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
                      <span className="font-semibold">Total</span>
                      <span className="text-lg font-semibold">{total} KGS</span>
                    </div>
                  </div>

                  <div className="grid gap-2 text-sm text-muted">
                    <p>Payment method: {paymentMethod}</p>
                    <p>Delivery method: {deliveryMethod}</p>
                  </div>

                  <Button className="w-full" onClick={() => setIsConfirmed(true)}>
                    Подтвердить заказ
                  </Button>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </Container>
      <PublicFooter />
    </main>
  );
}
