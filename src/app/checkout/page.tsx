"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { createOrderRealAction } from "@/app/actions/client/clientOrdersReal";
import { useCart } from "@/components/cart/CartRuntime";
import { EmptyState } from "@/components/catalog/EmptyState";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { SectionTitle } from "@/components/ui/SectionTitle";

function StepIndicator() {
  const steps = ["Корзина", "Проверка", "Создание заказа"];
  return (
    <div className="grid gap-3 rounded-lg border border-border/90 bg-surface/90 p-4 shadow-card sm:grid-cols-3">
      {steps.map((step, index) => (
        <div className={index === 1 ? "rounded-md bg-primary p-3 text-white" : "rounded-md border border-border/80 bg-background p-3"} key={step}>
          <p className="text-xs font-semibold uppercase tracking-wide">Шаг {index + 1}</p>
          <p className="mt-1 text-sm font-semibold">{step}</p>
        </div>
      ))}
    </div>
  );
}

export default function CheckoutPage() {
  const cart = useCart();
  const router = useRouter();
  const requestKeyRef = useRef<string | null>(null);
  const [message, setMessage] = useState<string>();
  const [messageTone, setMessageTone] = useState<"success" | "danger">("success");
  const [isPending, startTransition] = useTransition();

  const hasUnavailableItems = cart.items.some((item) => item.status !== "active");
  const isEmpty = cart.hydrated && cart.items.length === 0;

  function submitPickupOrder() {
    setMessage(undefined);

    if (!cart.hydrated || cart.items.length === 0) {
      setMessageTone("danger");
      setMessage("Корзина пуста.");
      return;
    }

    if (hasUnavailableItems) {
      setMessageTone("danger");
      setMessage("Удалите недоступные позиции из корзины перед оформлением.");
      return;
    }

    const businessIds = new Set(cart.items.map((item) => item.businessId));
    if (businessIds.size !== 1) {
      setMessageTone("danger");
      setMessage("Один атомарный заказ может относиться только к одному бизнесу. Разделите корзину по партнёрам.");
      return;
    }

    const orderTypes = new Set(cart.items.map((item) => item.itemType === "food" ? "food" : "shop"));
    if (orderTypes.size !== 1) {
      setMessageTone("danger");
      setMessage("Еду и товары магазина нужно оформить отдельными заказами.");
      return;
    }

    if (cart.items.some((item) => !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99)) {
      setMessageTone("danger");
      setMessage("Количество одной позиции должно быть от 1 до 99.");
      return;
    }

    const businessId = [...businessIds][0];
    const orderType = [...orderTypes][0] as "food" | "shop";
    const idempotencyKey = requestKeyRef.current ?? `checkout-${globalThis.crypto.randomUUID()}`;
    requestKeyRef.current = idempotencyKey;

    startTransition(async () => {
      const result = await createOrderRealAction({
        businessId,
        orderType,
        items: cart.items.map((item) => ({ itemId: item.id, qty: item.quantity })),
        deliveryMethod: "pickup",
        idempotencyKey
      });

      if (!result.ok || !result.orderId) {
        setMessageTone("danger");
        setMessage(result.code === "not_authorized"
          ? "Для реального заказа войдите в клиентский аккаунт."
          : `Заказ не создан: ${result.code ?? "server_rejected"}. Сервер не изменил order/payment truth.`);
        return;
      }

      setMessageTone("success");
      setMessage("Заказ создан атомарно. Сумма и позиции подтверждены базой данных.");
      requestKeyRef.current = null;
      cart.clear();
      router.push(`/client/orders/${result.orderId}`);
      router.refresh();
    });
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <Container className="space-y-8 py-10">
        <SectionTitle
          description="KÖL создаёт заказ только через server-authoritative транзакцию. Цена и итог пересчитываются по базе; browser не задаёт денежные значения."
          eyebrow="KÖL Checkout"
          title="Оформление заказа"
        />

        {!cart.hydrated ? (
          <Card><CardContent className="p-6 text-sm text-muted">Загружаем корзину…</CardContent></Card>
        ) : isEmpty ? (
          <Card>
            <CardContent className="grid gap-4 p-6">
              <EmptyState actionLabel="Перейти к еде" description="Добавьте блюда или товары перед оформлением." href="/food" title="Нет товаров для оформления" />
              <Link className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground sm:w-auto" href="/shop">Открыть магазин</Link>
            </CardContent>
          </Card>
        ) : (
          <>
            <StepIndicator />

            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="grid gap-2 p-5 text-sm leading-6 text-foreground">
                <p className="font-semibold">Реальный безопасный checkout</p>
                <p>Доступен только самовывоз. Delivery остаётся fail-closed, пока нет утверждённого server-authoritative fee/address contract.</p>
                <p>Контактная идентичность берётся из авторизованного клиентского аккаунта; browser не может подменить client_id.</p>
              </CardContent>
            </Card>

            {message ? (
              <Card className={messageTone === "success" ? "border-success/40 bg-success/5" : "border-danger/40 bg-danger/5"}>
                <CardContent className="space-y-3 p-5" role="status">
                  <p className={messageTone === "success" ? "font-semibold text-success" : "font-semibold text-danger"}>{message}</p>
                  {messageTone === "danger" && message.includes("войдите") ? (
                    <Link className="font-semibold text-primary hover:underline" href="/login?next=/checkout">Войти в клиентский аккаунт →</Link>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}

            <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Способ получения</CardTitle>
                    <CardDescription>Только методы с подтверждённым серверным контрактом доступны для записи.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 sm:grid-cols-2">
                    <label className="rounded-lg border border-primary bg-lake-light p-4">
                      <input checked readOnly className="mr-2" name="delivery-method" type="radio" />
                      <span className="font-semibold">Самовывоз</span>
                    </label>
                    <label className="rounded-lg border border-border bg-surface p-4 opacity-60">
                      <input disabled className="mr-2" name="delivery-method" type="radio" />
                      <span className="font-semibold">Доставка — пока недоступна</span>
                    </label>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Что проверит сервер</CardTitle>
                    <CardDescription>Browser отправляет только business, item IDs, quantity и idempotency key.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-2 text-sm leading-6 text-muted">
                    <p>• authenticated client identity через auth.uid()</p>
                    <p>• один approved business на заказ</p>
                    <p>• активность и принадлежность каждой позиции</p>
                    <p>• DB-authoritative цена и minimum order для Food</p>
                    <p>• tracked stock и atomic decrement для Shop</p>
                    <p>• idempotent replay без второго заказа/списания stock</p>
                  </CardContent>
                </Card>
              </div>

              <Card className="lg:sticky lg:top-24">
                <CardHeader>
                  <CardTitle>Итог перед сервером</CardTitle>
                  <CardDescription>Цены ниже — только browser preview. Финальный total определяет база.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    {cart.items.map((item) => (
                      <div className="rounded-md bg-background p-3 text-sm" key={`${item.itemType}:${item.id}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div><p className="font-semibold">{item.title}</p><p className="text-muted">{item.partnerName}</p></div>
                          <Badge variant={item.status === "active" ? "success" : "warning"}>{item.status === "active" ? "В наличии" : "Недоступно"}</Badge>
                        </div>
                        <p className="mt-2 text-muted">{item.quantity} × {item.price} {item.currency}</p>
                      </div>
                    ))}
                  </div>
                  <div className="grid gap-3 rounded-md bg-background p-4 text-sm">
                    <div className="flex items-center justify-between gap-3"><span className="text-muted">Browser preview</span><span className="font-semibold">{cart.subtotal} KGS</span></div>
                    <div className="flex items-start justify-between gap-3 border-t border-border pt-3"><span className="text-muted">Доставка</span><span className="font-semibold">Самовывоз · 0 KGS</span></div>
                    <div className="flex items-start justify-between gap-3"><span className="font-semibold">Финальная сумма</span><span className="max-w-[55%] text-right font-semibold">Определит сервер</span></div>
                  </div>
                  <Button className="w-full" disabled={isPending} onClick={submitPickupOrder}>
                    {isPending ? "Создаём заказ…" : "Оформить самовывоз"}
                  </Button>
                  <Link className="block text-center text-sm font-semibold text-primary hover:underline" href="/cart">Вернуться в корзину</Link>
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
