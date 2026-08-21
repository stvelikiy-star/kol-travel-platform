"use client";

import Link from "next/link";
import { useState } from "react";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { Input } from "@/components/ui/Input";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Textarea } from "@/components/ui/Textarea";
import { mockRooms, mockStays } from "@/data/mockStays";
import { mockTours } from "@/data/mockTours";
import { cn } from "@/lib/cn";

type BookingType = "tour" | "stay";

const tour = mockTours[0];
const stay = mockStays[0];
const room = mockRooms[0];
const bookingSteps = ["Выбор", "Контакты", "Подтверждение"];

export default function BookingCheckoutPage() {
  const [bookingType, setBookingType] = useState<BookingType>("tour");
  const [isPrepared, setIsPrepared] = useState(false);

  const isTour = bookingType === "tour";
  const title = isTour ? tour?.title ?? "Выбранный тур" : stay?.title ?? "Выбранное жильё";
  const location = isTour ? tour?.location ?? "Иссык-Куль" : stay?.location ?? "Иссык-Куль";
  const currency = isTour ? tour?.currency ?? "KGS" : stay?.currency ?? "KGS";
  const basePrice = isTour
    ? tour?.price ?? 0
    : room?.pricePerNight ?? stay?.minPricePerNight ?? 0;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <Container className="space-y-8 py-10">
        <section className="grid gap-6 rounded-lg border border-border/80 bg-gradient-to-br from-lake-light via-surface to-sand-light p-6 shadow-soft lg:grid-cols-[1fr_360px] lg:items-center">
          <SectionTitle
            description="Проверьте выбранный объект и оставьте контакты. Доступность и финальная стоимость подтверждаются перед созданием брони."
            eyebrow="KÖL Booking"
            title="Оформление бронирования"
          />
          <div className="rounded-lg bg-gradient-to-br from-lake-dark via-primary to-sand p-5 text-white shadow-card">
            <p className="text-sm font-semibold uppercase tracking-wide">Один аккаунт KÖL</p>
            <p className="mt-3 text-2xl font-semibold leading-tight">
              Туры и жильё в едином процессе бронирования
            </p>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <ChoiceButton
            active={isTour}
            description="Экскурсии, активности, гиды и маршруты"
            label="Тур"
            onClick={() => { setBookingType("tour"); setIsPrepared(false); }}
          />
          <ChoiceButton
            active={!isTour}
            description="Отели, гостевые дома, коттеджи и другие варианты"
            label="Жильё"
            onClick={() => { setBookingType("stay"); setIsPrepared(false); }}
          />
        </div>

        <div className="grid gap-3 rounded-lg border border-border/90 bg-surface/90 p-4 shadow-card sm:grid-cols-3">
          {bookingSteps.map((step, index) => (
            <div
              className={cn(
                "rounded-md p-3",
                step === "Контакты" ? "bg-primary text-white" : "bg-background text-foreground"
              )}
              key={step}
            >
              <p className="text-xs font-semibold uppercase tracking-wide">Шаг {index + 1}</p>
              <p className="mt-1 text-sm font-semibold">{step}</p>
            </div>
          ))}
        </div>

        {isPrepared ? (
          <Card className="border-success/40 bg-success/5">
            <CardContent className="p-5">
              <p className="font-semibold text-success">Данные готовы к подтверждению.</p>
              <p className="mt-2 text-sm leading-6 text-muted">
                При рабочем бронировании система повторно проверяет свободные места и рассчитывает сумму на сервере перед созданием записи.
              </p>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{isTour ? "Выбранный тур" : "Выбранное жильё"}</CardTitle>
                <CardDescription>Основная информация перед оформлением.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <Info label={isTour ? "Тур" : "Объект"} value={title} />
                <Info label="Локация" value={location} />
                {!isTour ? <Info label="Вариант размещения" value={room?.title ?? "Уточняется"} /> : null}
                <Info
                  label={isTour ? "Цена за участника" : "Базовая цена за ночь"}
                  value={basePrice > 0 ? `${basePrice} ${currency}` : "Уточняется"}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Контактные данные</CardTitle>
                <CardDescription>Используются для связи по бронированию и уведомлений о статусе.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <Input autoComplete="name" placeholder="Имя" />
                <Input autoComplete="tel" placeholder="Телефон" />
                <Input autoComplete="email" className="md:col-span-2" placeholder="Email, опционально" type="email" />
                <Textarea className="md:col-span-2" placeholder="Комментарий или пожелания" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Даты и гости</CardTitle>
                <CardDescription>Финальная проверка выполняется перед подтверждением.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <Input aria-label={isTour ? "Дата тура" : "Дата заезда"} type="date" />
                {!isTour ? <Input aria-label="Дата выезда" type="date" /> : null}
                <Input defaultValue={2} min={1} placeholder={isTour ? "Участников" : "Гостей"} type="number" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Условия</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm leading-6 text-muted">
                <p>Точные условия отмены, переноса и оплаты показываются для конкретного предложения после их утверждения партнёром.</p>
                <p>KÖL не подставляет неподтверждённые правила или суммы в финальное бронирование.</p>
              </CardContent>
            </Card>
          </div>

          <Card className="lg:sticky lg:top-24">
            <CardHeader>
              <CardTitle>Итог заявки</CardTitle>
              <CardDescription>Перед подтверждением данные будут проверены ещё раз.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge>{isTour ? "Тур" : "Жильё"}</Badge>
                <Badge variant="info">{location}</Badge>
              </div>
              <div className="grid gap-3 rounded-md bg-background p-4 text-sm">
                <SummaryRow label="Выбрано" value={title} />
                <SummaryRow label="Базовая цена" value={basePrice > 0 ? `${basePrice} ${currency}` : "Уточняется"} />
                <SummaryRow label="Финальная сумма" value="После проверки дат и доступности" />
              </div>
              <Button className="w-full" onClick={() => setIsPrepared(true)}>
                Проверить данные
              </Button>
              <Link className="block text-center text-sm font-semibold text-primary hover:underline" href={isTour ? "/tours" : "/stays"}>
                Вернуться к выбору
              </Link>
            </CardContent>
          </Card>
        </div>
      </Container>
      <PublicFooter />
    </main>
  );
}

function ChoiceButton({
  active,
  description,
  label,
  onClick
}: {
  active: boolean;
  description: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "rounded-lg border p-5 text-left shadow-sm transition",
        active ? "border-primary bg-surface" : "border-border bg-surface hover:border-primary"
      )}
      onClick={onClick}
      type="button"
    >
      <span className="text-lg font-semibold">{label}</span>
      <span className="mt-2 block text-sm leading-6 text-muted">{description}</span>
    </button>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-background p-3 text-sm">
      <p className="text-muted">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted">{label}</span>
      <span className="max-w-[60%] text-right font-semibold">{value}</span>
    </div>
  );
}
