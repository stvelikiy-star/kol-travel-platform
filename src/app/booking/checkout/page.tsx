"use client";

import Link from "next/link";
import { useState } from "react";
import { EmptyState } from "@/components/catalog/EmptyState";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { Input } from "@/components/ui/Input";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Textarea } from "@/components/ui/Textarea";
import { mockPartners } from "@/data/mockPartners";
import { mockRooms, mockStays } from "@/data/mockStays";
import { mockTourSchedules, mockTours } from "@/data/mockTours";
import { cn } from "@/lib/cn";

type BookingType = "tour" | "stay";

const tour = mockTours[0];
const tourSchedule = mockTourSchedules[0];
const stay = mockStays[0];
const room = mockRooms[0];
const tourPartner = mockPartners.find((partner) => partner.id === tour?.businessId);
const stayPartner = mockPartners.find((partner) => partner.id === stay?.businessId);
const hasBookingData = Boolean(tour && stay);

const bookingSteps = ["Выбор", "Данные", "Подтверждение"];

export default function BookingCheckoutPage() {
  const [bookingType, setBookingType] = useState<BookingType>("tour");
  const [paymentMethod, setPaymentMethod] = useState("manual");
  const [isConfirmed, setIsConfirmed] = useState(false);

  const isTour = bookingType === "tour";
  const guests = isTour ? 2 : 3;
  const nights = 2;
  const pricePerNight = room?.pricePerNight ?? stay.minPricePerNight;
  const subtotal = isTour ? tour.price * guests : pricePerNight * nights;
  const discount = 0;
  const points = 0;
  const prepayment = 0;
  const total = subtotal - discount - points;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicHeader />

      <Container className="space-y-8 py-10">
        <section className="grid gap-6 rounded-lg border border-border/80 bg-gradient-to-br from-lake-light via-surface to-sand-light p-6 shadow-soft lg:grid-cols-[1fr_360px] lg:items-center">
          <SectionTitle
            description="Проверьте данные тура или жилья, даты, гостей, контакты и условия отмены."
            eyebrow="Booking checkout demo"
            title="Оформление бронирования"
          />
          <div className="rounded-lg bg-gradient-to-br from-lake-dark via-primary to-sand p-5 text-white shadow-card">
            <p className="text-sm font-semibold uppercase tracking-wide">KÖL booking</p>
            <p className="mt-3 text-2xl font-semibold leading-tight">
              Тур или жильё подтверждаются партнёром
            </p>
          </div>
        </section>

        {!hasBookingData ? (
          <Card>
            <CardContent className="grid gap-4 p-6">
              <EmptyState
                actionLabel="Смотреть туры"
                description="Выберите тур или жильё в каталоге."
                href="/tours"
                title="Нет объекта для бронирования"
              />
              <Link
                className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:border-primary hover:text-primary sm:w-auto"
                href="/stays"
              >
                Смотреть жильё
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
              <ChoiceButton
                active={isTour}
                description="Катер, экскурсия, гид или маршрут"
                label="Тур"
                onClick={() => setBookingType("tour")}
              />
              <ChoiceButton
                active={!isTour}
                description="Отель, гостевой дом, коттедж или вилла"
                label="Жильё"
                onClick={() => setBookingType("stay")}
              />
            </div>

            <div className="grid gap-3 rounded-lg border border-border/90 bg-surface/90 p-4 shadow-card sm:grid-cols-3">
              {bookingSteps.map((step, index) => {
                const isCurrent = step === "Данные";

                return (
                  <div
                    className={cn(
                      "rounded-md p-3",
                      isCurrent ? "bg-primary text-white" : "bg-background text-foreground"
                    )}
                    key={step}
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide">Шаг {index + 1}</p>
                    <p className="mt-1 text-sm font-semibold">{step}</p>
                  </div>
                );
              })}
            </div>

            <Card className="border-warning/40 bg-warning/10">
              <CardContent className="p-5 text-sm font-medium leading-6 text-foreground">
                Это demo booking checkout. Реальное создание брони, проверка доступности, оплата и
                уведомления будут подключены на следующих этапах.
              </CardContent>
            </Card>

            {isConfirmed ? (
              <Card className="border-success">
                <CardContent className="grid gap-3 p-5 text-sm font-semibold text-success">
                  <p>Бронь создана в demo mode. Реальное подтверждение партнёром будет подключено позже.</p>
                  <Link
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-success bg-surface px-4 py-2 text-sm font-semibold text-success shadow-sm transition hover:opacity-90 sm:w-auto"
                    href="/booking/success"
                  >
                    Открыть demo confirmation
                  </Link>
                </CardContent>
              </Card>
            ) : null}

            <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>{isTour ? "Данные тура" : "Данные жилья"}</CardTitle>
                    <CardDescription>
                      {isTour
                        ? "Mock summary выбранного тура."
                        : "Mock summary выбранного объекта жилья."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    {isTour ? (
                      <>
                        <Info label="Тур" value={tour.title} />
                        <Info label="Локация" value={tour.location} />
                        <Info label="Дата" value={tourSchedule?.date ?? "по запросу"} />
                        <Info label="Время" value={tourSchedule?.startTime ?? "по запросу"} />
                        <Info label="Гостей" value={String(guests)} />
                        <Info label="Цена за человека" value={`${tour.price} ${tour.currency}`} />
                        <Info label="Итог" value={`${subtotal} ${tour.currency}`} />
                        <Info label="Партнёр / гид" value={tourPartner?.title ?? "KÖL Partner"} />
                        <Info
                          label="Доступность"
                          value={tourSchedule ? tourSchedule.status : "по запросу"}
                        />
                      </>
                    ) : (
                      <>
                        <Info label="Жильё" value={stay.title} />
                        <Info label="Тип номера" value={room?.title ?? "по запросу"} />
                        <Info label="Дата заезда" value="2026-07-01" />
                        <Info label="Дата выезда" value="2026-07-03" />
                        <Info label="Ночей" value={String(nights)} />
                        <Info label="Гостей" value={String(guests)} />
                        <Info label="Цена за ночь" value={`${pricePerNight} ${stay.currency}`} />
                        <Info label="Итог" value={`${subtotal} ${stay.currency}`} />
                        <Info label="Партнёр / отель" value={stayPartner?.title ?? "KÖL Partner"} />
                        <Info label="Доступность" value="available" />
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Контакты</CardTitle>
                    <CardDescription>Контакты нужны для подтверждения брони партнёром.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <Input placeholder="Имя" />
                    <Input placeholder="Телефон" />
                    <Input className="md:col-span-2" placeholder="Email, опционально" />
                    <Textarea className="md:col-span-2" placeholder="Комментарий" />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Гости</CardTitle>
                    <CardDescription>Поля пока не отправляются в backend.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <Input defaultValue={2} min={1} placeholder="Количество взрослых" type="number" />
                    <Input defaultValue={0} min={0} placeholder="Количество детей" type="number" />
                    <Textarea className="md:col-span-2" placeholder="Особые пожелания" />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Правила бронирования</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 text-sm text-muted">
                    <p>Правила отмены зависят от партнёра и будут уточняться в booking flow.</p>
                    <p>Бронь подтверждается партнёром вручную или через будущую CRM.</p>
                    <p>Предоплата/manual payment доступны как MVP-сценарий.</p>
                    <p>No-show фиксируется отдельно и может влиять на правила отмены.</p>
                    <p>Изменение дат возможно через поддержку.</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Оплата</CardTitle>
                    <CardDescription>
                      Онлайн-платежи и автоматическая предоплата будут подключены после юридической и
                      платёжной настройки.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-2">
                    <PaymentChoice
                      active={paymentMethod === "manual"}
                      label={isTour ? "Оплата перед туром" : "Оплата при заселении"}
                      onClick={() => setPaymentMethod("manual")}
                    />
                    <PaymentChoice
                      active={paymentMethod === "transfer"}
                      label="Перевод"
                      onClick={() => setPaymentMethod("transfer")}
                    />
                    <PaymentChoice disabled label="Предоплата — soon" />
                    <PaymentChoice disabled label="Онлайн оплата — soon" />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Промокод и баллы</CardTitle>
                    <CardDescription>Demo UI only: промокод и баллы не применяются реально.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-[1fr_auto]">
                    <Input placeholder="Промокод" />
                    <Button variant="outline">Применить</Button>
                    <button
                      className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-border bg-background p-4 text-left text-sm font-semibold transition hover:border-primary md:col-span-2"
                      type="button"
                    >
                      <span>Использовать баллы</span>
                      <Badge variant="muted">demo</Badge>
                    </button>
                  </CardContent>
                </Card>
              </div>

              <Card className="lg:sticky lg:top-24">
                <CardHeader>
                  <CardTitle>Final summary</CardTitle>
                  <CardDescription>Итог бронирования без реальной отправки.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge>{isTour ? "Тур" : "Жильё"}</Badge>
                    <Badge variant="info">{isTour ? tour.location : stay.location}</Badge>
                  </div>
                  <div className="grid gap-3 rounded-md bg-background p-4 text-sm">
                    <SummaryRow label="Subtotal" value={`${subtotal} KGS`} />
                    <SummaryRow label="Discount placeholder" value={`-${discount} KGS`} />
                    <SummaryRow label="Points placeholder" value={`-${points} KGS`} />
                    <SummaryRow label="Prepayment placeholder" value={`${prepayment} KGS`} />
                    <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
                      <span className="font-semibold">Total</span>
                      <span className="text-lg font-semibold">{total} KGS</span>
                    </div>
                  </div>
                  <Button className="w-full" onClick={() => setIsConfirmed(true)}>
                    Подтвердить бронь
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
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function PaymentChoice({
  active = false,
  disabled = false,
  label,
  onClick
}: {
  active?: boolean;
  disabled?: boolean;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      className={cn(
        "min-h-16 rounded-lg border p-4 text-left text-sm font-semibold shadow-sm transition",
        active ? "border-primary bg-background text-foreground" : "border-border bg-surface",
        disabled ? "cursor-not-allowed opacity-60" : "hover:border-primary"
      )}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}
