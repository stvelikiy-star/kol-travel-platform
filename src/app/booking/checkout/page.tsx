"use client";

import { Suspense, useState } from "react";\nimport { useSearchParams } from "next/navigation";
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

type BookingType = "tour" | "stay";

export default function BookingCheckoutPage() {
  return <Suspense fallback={<main className="min-h-screen bg-background" />}><BookingCheckoutForm /></Suspense>;
}

function BookingCheckoutForm() {
  const searchParams = useSearchParams();
  const initialType: BookingType = searchParams.get("type") === "stay" ? "stay" : "tour";
  const initialObjectId = (searchParams.get("id") ?? "").slice(0, 120);
  const initialObjectTitle = (searchParams.get("title") ?? "").slice(0, 200);
  const [bookingType, setBookingType] = useState<BookingType>(initialType);
  const [objectId] = useState(initialObjectId);
  const [objectTitle, setObjectTitle] = useState(initialObjectTitle);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [comment, setComment] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("after_confirmation");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const type = params.get("type") === "stay" ? "stay" : "tour";
    setBookingType(type);
    setObjectId((params.get("id") ?? "").slice(0, 120));
    setObjectTitle((params.get("title") ?? "").slice(0, 200));
  }, []);

  async function submitRequest() {
    setSubmitError(null);
    setRequestId(null);
    if (name.trim().length < 2 || phone.trim().length < 5) { setSubmitError("Укажите имя и телефон для связи с оператором."); return; }
    if (objectTitle.trim().length < 2) { setSubmitError("Укажите тур или объект размещения."); return; }
    if (!startDate) { setSubmitError("Укажите желаемую дату."); return; }
    if (bookingType === "stay" && endDate && endDate <= startDate) { setSubmitError("Дата выезда должна быть позже даты заезда."); return; }

    setIsSubmitting(true);
    try {
      const result = await submitPublicIntakeRequest({
        kind: "booking_request",
        title: `Заявка на ${bookingType === "tour" ? "тур" : "жильё"} · ${objectTitle.trim()}`,
        contact: { name, phone, email },
        payload: {
          request_type: bookingType,
          object: { id: objectId || null, title: objectTitle.trim() },
          dates: { start: startDate, ...(bookingType === "stay" && endDate ? { end: endDate } : {}) },
          guests: { adults, children },
          payment_preference: paymentMethod,
          comment,
          quoted: false,
          source_path: "/booking/checkout"
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
        <SectionTitle eyebrow="Реальная заявка" title="Бронирование тура или жилья" description="Без регистрации. KÖL сохранит заявку, оператор проверит доступность и подтвердит условия." />

        <div className="grid gap-4 sm:grid-cols-2">
          <button className={bookingType === "tour" ? "rounded-lg border border-primary bg-primary p-5 text-left text-white" : "rounded-lg border border-border bg-surface p-5 text-left"} onClick={() => setBookingType("tour")} type="button"><span className="text-lg font-semibold">Тур</span><span className="mt-2 block text-sm">Экскурсия, гид, катер или маршрут</span></button>
          <button className={bookingType === "stay" ? "rounded-lg border border-primary bg-primary p-5 text-left text-white" : "rounded-lg border border-border bg-surface p-5 text-left"} onClick={() => setBookingType("stay")} type="button"><span className="text-lg font-semibold">Жильё</span><span className="mt-2 block text-sm">Отель, гостевой дом, коттедж или номер</span></button>
        </div>

        <Card className="border-primary/30 bg-lake-light/40"><CardContent className="p-5 text-sm leading-6">Заявка не является подтверждённой бронью и не списывает деньги. Оператор сначала проверит доступность и цену.</CardContent></Card>
        {requestId ? <Card className="border-success"><CardContent className="grid gap-2 p-5 text-sm text-success"><p className="font-semibold">Заявка принята.</p><p>Номер: <span className="font-mono font-semibold">{requestId}</span></p><p>Оператор свяжется с вами после проверки.</p></CardContent></Card> : null}
        {submitError ? <Card className="border-danger"><CardContent className="p-5 text-sm font-semibold text-danger">{submitError}</CardContent></Card> : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>{bookingType === "tour" ? "Тур" : "Объект размещения"}</CardTitle><CardDescription>Название подставляется из выбранной карточки, но его можно уточнить.</CardDescription></CardHeader>
            <CardContent className="grid gap-4"><Input placeholder={bookingType === "tour" ? "Название тура *" : "Название отеля / жилья *"} value={objectTitle} onChange={(e) => setObjectTitle(e.target.value)} /><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />{bookingType === "stay" ? <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /> : null}</CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Контакты</CardTitle><CardDescription>Имя и телефон обязательны.</CardDescription></CardHeader>
            <CardContent className="grid gap-4"><Input placeholder="Ваше имя *" value={name} onChange={(e) => setName(e.target.value)} /><Input placeholder="Телефон *" value={phone} onChange={(e) => setPhone(e.target.value)} /><Input placeholder="Email, опционально" value={email} onChange={(e) => setEmail(e.target.value)} /></CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Гости</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2"><Input min={1} type="number" value={adults} onChange={(e) => setAdults(Math.max(1, Number(e.target.value) || 1))} /><Input min={0} type="number" value={children} onChange={(e) => setChildren(Math.max(0, Number(e.target.value) || 0))} /><Textarea className="sm:col-span-2" placeholder="Комментарий: пожелания, номер, маршрут и т.д." value={comment} onChange={(e) => setComment(e.target.value)} /></CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Подтверждение</CardTitle><CardDescription>Финальная цена определяется после проверки оператором/партнёром.</CardDescription></CardHeader>
            <CardContent className="grid gap-4"><Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}><option value="after_confirmation">Оплата после подтверждения</option><option value="cash">Наличные</option><option value="transfer">Перевод</option></Select><Button className="w-full" disabled={isSubmitting} onClick={submitRequest}>{isSubmitting ? "Отправляем…" : "Отправить заявку на бронирование"}</Button></CardContent>
          </Card>
        </div>
      </Container>
      <PublicFooter />
    </main>
  );
}
