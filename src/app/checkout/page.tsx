"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/components/cart/CartRuntime";
import { EmptyState } from "@/components/catalog/EmptyState";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { Input } from "@/components/ui/Input";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";

const locations = ["Чолпон-Ата", "Бостери", "Каракол", "Тамчы", "Бактуу-Долоноту", "Сары-Ой"];

function StepIndicator() {
  const steps = ["Корзина", "Оформление", "Проверка"];
  return <div className="grid gap-3 rounded-lg border border-border/90 bg-surface/90 p-4 shadow-card sm:grid-cols-3">{steps.map((step, index) => <div className={step === "Оформление" ? "rounded-md bg-primary p-3 text-white" : "rounded-md border border-border/80 bg-background p-3"} key={step}><p className="text-xs font-semibold uppercase tracking-wide">Шаг {index + 1}</p><p className="mt-1 text-sm font-semibold">{step}</p></div>)}</div>;
}

export default function CheckoutPage() {
  const cart = useCart();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState<"delivery" | "pickup">("delivery");
  const [location, setLocation] = useState("");
  const [address, setAddress] = useState("");
  const [comment, setComment] = useState("");
  const [validationMessage, setValidationMessage] = useState<string>();
  const [prepared, setPrepared] = useState(false);

  const hasUnavailableItems = cart.items.some((item) => item.status !== "active");
  const isEmpty = cart.hydrated && cart.items.length === 0;

  function validate() {
    setPrepared(false);
    if (!name.trim() || !phone.trim()) {
      setValidationMessage("Заполните имя и телефон для связи по заказу.");
      return;
    }
    if (hasUnavailableItems) {
      setValidationMessage("Удалите недоступные позиции из корзины перед оформлением.");
      return;
    }
    if (deliveryMethod === "delivery" && (!location || !address.trim())) {
      setValidationMessage("Для доставки выберите локацию и укажите адрес.");
      return;
    }
    setValidationMessage(undefined);
    setPrepared(true);
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <Container className="space-y-8 py-10">
        <SectionTitle description="Проверьте корзину и заполните данные для связи. Финальная доставка, оплата и создание заказа подтверждаются сервером." eyebrow="KÖL Checkout" title="Оформление заказа" />

        {!cart.hydrated ? <Card><CardContent className="p-6 text-sm text-muted">Загружаем корзину…</CardContent></Card> : isEmpty ? (
          <Card><CardContent className="grid gap-4 p-6"><EmptyState actionLabel="Перейти к еде" description="Добавьте блюда или товары перед оформлением." href="/food" title="Нет товаров для оформления" /><Link className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground sm:w-auto" href="/shop">Открыть магазин</Link></CardContent></Card>
        ) : (
          <>
            <StepIndicator />
            <Card className="border-warning/40 bg-warning/10"><CardContent className="p-5 text-sm leading-6 text-foreground">Presentation mode: данные можно полностью заполнить и проверить, но заказ не считается созданным до серверной транзакции.</CardContent></Card>

            {validationMessage ? <Card className="border-danger/40 bg-danger/5"><CardContent className="p-5"><p className="font-semibold text-danger" role="alert">{validationMessage}</p></CardContent></Card> : null}
            {prepared ? <Card className="border-success/40 bg-success/5"><CardContent className="p-5" role="status"><p className="font-semibold text-success">Заявка заполнена и готова к серверной отправке.</p><p className="mt-2 text-sm leading-6 text-muted">KÖL ещё не показывает «заказ создан», пока сервер не подтвердил наличие, доставку, итоговую сумму и запись заказа.</p></CardContent></Card> : null}

            <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
              <div className="space-y-6">
                <Card>
                  <CardHeader><CardTitle>Контакты</CardTitle><CardDescription>Имя и телефон обязательны для связи.</CardDescription></CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <Input autoComplete="name" onChange={(event) => setName(event.target.value)} placeholder="Ваше имя" required value={name} />
                    <Input autoComplete="tel" onChange={(event) => setPhone(event.target.value)} placeholder="+996" required value={phone} />
                    <Input autoComplete="email" className="md:col-span-2" placeholder="Email, опционально" type="email" />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>Способ получения</CardTitle><CardDescription>Выберите доставку или самовывоз.</CardDescription></CardHeader>
                  <CardContent className="grid gap-3 sm:grid-cols-2">
                    {[{ value: "delivery", label: "Доставка" }, { value: "pickup", label: "Самовывоз" }].map((method) => <label className={deliveryMethod === method.value ? "rounded-lg border border-primary bg-lake-light p-4" : "rounded-lg border border-border bg-surface p-4"} key={method.value}><input checked={deliveryMethod === method.value} className="mr-2" name="delivery-method" onChange={() => { setDeliveryMethod(method.value as "delivery" | "pickup"); setPrepared(false); }} type="radio" /><span className="font-semibold">{method.label}</span></label>)}
                  </CardContent>
                </Card>

                {deliveryMethod === "delivery" ? (
                  <Card>
                    <CardHeader><CardTitle>Адрес доставки</CardTitle><CardDescription>Стоимость доставки не подставляется без подтверждённых правил.</CardDescription></CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2">
                      <Select onChange={(event) => setLocation(event.target.value)} required value={location}><option value="" disabled>Выберите локацию</option>{locations.map((item) => <option key={item} value={item}>{item}</option>)}</Select>
                      <Input onChange={(event) => setAddress(event.target.value)} placeholder="Улица, дом, корпус" required value={address} />
                      <Textarea className="md:col-span-2" onChange={(event) => setComment(event.target.value)} placeholder="Комментарий курьеру, опционально" value={comment} />
                    </CardContent>
                  </Card>
                ) : null}

                <Card className="border-border/90 bg-background"><CardContent className="p-5 text-sm leading-6 text-muted"><p className="font-semibold text-foreground">Промокоды, баллы и онлайн-оплата</p><p className="mt-2">Эти действия не показываются как активные, пока в проекте нет утверждённых правил и рабочего серверного обработчика.</p></CardContent></Card>
              </div>

              <Card className="lg:sticky lg:top-24">
                <CardHeader><CardTitle>Итог заявки</CardTitle><CardDescription>Только фактически выбранные позиции.</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">{cart.items.map((item) => <div className="rounded-md bg-background p-3 text-sm" key={`${item.itemType}:${item.id}`}><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{item.title}</p><p className="text-muted">{item.partnerName}</p></div><Badge variant={item.status === "active" ? "success" : "warning"}>{item.status === "active" ? "В наличии" : "Недоступно"}</Badge></div><p className="mt-2 text-muted">{item.quantity} × {item.price} {item.currency}</p></div>)}</div>
                  <div className="grid gap-3 rounded-md bg-background p-4 text-sm"><div className="flex items-center justify-between gap-3"><span className="text-muted">Товары</span><span className="font-semibold">{cart.subtotal} KGS</span></div><div className="flex items-start justify-between gap-3 border-t border-border pt-3"><span className="text-muted">Доставка</span><span className="max-w-[55%] text-right font-semibold">После серверной проверки</span></div><div className="flex items-start justify-between gap-3"><span className="font-semibold">Финальная сумма</span><span className="max-w-[55%] text-right font-semibold">После проверки</span></div></div>
                  <Button className="w-full" onClick={validate}>Проверить заявку</Button>
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
