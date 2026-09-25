"use client";

import { useEffect, useState } from "react";
import { submitPublicIntakeRequest } from "@/app/actions/public/intake";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { Input } from "@/components/ui/Input";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";

const locations = ["Чолпон-Ата", "Бостери", "Каракол", "Тамчы", "Бактуу-Долоноту", "Сары-Ой", "Другое"];

export default function CheckoutPage() {
  const [requestId, setRequestId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [location, setLocation] = useState("");
  const [address, setAddress] = useState("");
  const [comment, setComment] = useState("");
  const [orderDetails, setOrderDetails] = useState("");
  const [sourceItem, setSourceItem] = useState<Record<string, string>>({});
  const [deliveryMethod, setDeliveryMethod] = useState<"delivery" | "pickup">("delivery");
  const [paymentMethod, setPaymentMethod] = useState("cash_or_transfer");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const item = (params.get("item") ?? "").slice(0, 200);
    const partner = (params.get("partner") ?? "").slice(0, 200);
    const kind = (params.get("kind") ?? "").slice(0, 40);
    const price = (params.get("price") ?? "").slice(0, 40);
    const currency = (params.get("currency") ?? "KGS").slice(0, 10);
    if (item) {
      setOrderDetails((current) => current || `${item}${partner ? ` · ${partner}` : ""}`);
      setSourceItem({ item, partner, kind, price, currency });
    }
  }, []);

  async function submitRequest() {
    setSubmitError(null);
    setRequestId(null);
    if (name.trim().length < 2 || phone.trim().length < 5) {
      setSubmitError("Укажите имя и телефон для связи с оператором.");
      return;
    }
    if (orderDetails.trim().length < 3) {
      setSubmitError("Опишите, что вы хотите заказать.");
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await submitPublicIntakeRequest({
        kind: "order_request",
        title: `Заявка на заказ · ${name.trim()}`,
        contact: { name, phone, email },
        payload: {
          request_type: "order",
          requested_items: orderDetails.trim(),
          source_item: sourceItem,
          delivery_method: deliveryMethod,
          payment_preference: paymentMethod,
          delivery: { location, address },
          comment,
          quoted: false,
          source_path: "/checkout"
        }
      });
      if (!result.ok) { setSubmitError(result.message); return; }
      setRequestId(result.requestId);
    } catch {
      setSubmitError("Не удалось отправить заявку. Подтверждение не создано — попробуйте ещё раз.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <Container className="space-y-8 py-10">
        <SectionTitle eyebrow="Реальная заявка" title="Заказать еду или товар" description="Без регистрации. Укажите, что нужно, и контакты. Оператор KÖL подтвердит наличие, цену и доставку." />

        <Card className="border-primary/30 bg-lake-light/40"><CardContent className="p-5 text-sm leading-6">Заявка сохраняется в системе сразу. Это не автоматическая оплата и не окончательное подтверждение заказа.</CardContent></Card>

        {requestId ? <Card className="border-success"><CardContent className="grid gap-2 p-5 text-sm text-success"><p className="font-semibold">Заявка принята.</p><p>Номер: <span className="font-mono font-semibold">{requestId}</span></p><p>Оператор свяжется с вами для подтверждения.</p></CardContent></Card> : null}
        {submitError ? <Card className="border-danger"><CardContent className="p-5 text-sm font-semibold text-danger">{submitError}</CardContent></Card> : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Контакты</CardTitle><CardDescription>Имя и телефон обязательны.</CardDescription></CardHeader>
            <CardContent className="grid gap-4">
              <Input placeholder="Ваше имя *" value={name} onChange={(e) => setName(e.target.value)} />
              <Input placeholder="Телефон *" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <Input placeholder="Email, опционально" value={email} onChange={(e) => setEmail(e.target.value)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Что нужно</CardTitle><CardDescription>Можно написать несколько товаров или блюд одной заявкой.</CardDescription></CardHeader>
            <CardContent><Textarea className="min-h-36" placeholder="Например: 2 порции плова, вода 1.5 л × 2" value={orderDetails} onChange={(e) => setOrderDetails(e.target.value)} /></CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Получение</CardTitle></CardHeader>
            <CardContent className="grid gap-4">
              <Select value={deliveryMethod} onChange={(e) => setDeliveryMethod(e.target.value as "delivery" | "pickup")}><option value="delivery">Доставка</option><option value="pickup">Самовывоз</option></Select>
              <Select value={location} onChange={(e) => setLocation(e.target.value)}><option value="">Выберите населённый пункт</option>{locations.map((item) => <option key={item} value={item}>{item}</option>)}</Select>
              <Input placeholder="Адрес / отель / ориентир" value={address} onChange={(e) => setAddress(e.target.value)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Дополнительно</CardTitle></CardHeader>
            <CardContent className="grid gap-4">
              <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}><option value="cash_or_transfer">Оплата после подтверждения</option><option value="cash">Наличные</option><option value="transfer">Перевод</option></Select>
              <Textarea placeholder="Комментарий оператору" value={comment} onChange={(e) => setComment(e.target.value)} />
              <Button className="w-full" disabled={isSubmitting} onClick={submitRequest}>{isSubmitting ? "Отправляем…" : "Отправить заявку"}</Button>
            </CardContent>
          </Card>
        </div>
      </Container>
      <PublicFooter />
    </main>
  );
}
