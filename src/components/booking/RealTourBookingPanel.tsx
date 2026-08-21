"use client";

import Link from "next/link";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { createTourBookingRealAction } from "@/app/actions/client/clientBookingsReal";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { Tour, TourSchedule } from "@/types";

function newIdempotencyKey() {
  return `kol-tour-${globalThis.crypto.randomUUID()}`;
}

function resultMessage(code: string | undefined, fallback: string) {
  switch (code) {
    case "not_authenticated":
    case "not_authorized":
      return "Для бронирования войдите в аккаунт KÖL.";
    case "invalid_participants":
      return "Проверьте количество участников.";
    case "booking_rejected":
      return "Выбранное время уже недоступно или свободных мест недостаточно.";
    case "supabase_not_configured":
      return "Онлайн-бронирование временно недоступно.";
    default:
      return fallback;
  }
}

export function RealTourBookingPanel({ tour, schedules }: { tour: Tour; schedules: TourSchedule[] }) {
  const [scheduleId, setScheduleId] = useState(schedules[0]?.id ?? "");
  const [participants, setParticipants] = useState(1);
  const [message, setMessage] = useState<string>();
  const [bookingId, setBookingId] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const fingerprintRef = useRef<string | undefined>(undefined);
  const idempotencyKeyRef = useRef<string | undefined>(undefined);

  const selectedSchedule = schedules.find((schedule) => schedule.id === scheduleId) ?? schedules[0];
  const remaining = selectedSchedule
    ? Math.max(selectedSchedule.capacity - selectedSchedule.bookedSeats, 0)
    : 0;
  const hasSchedules = schedules.length > 0;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBookingId(undefined);

    if (!scheduleId || participants < 1) {
      setMessage("Выберите дату и количество участников.");
      return;
    }

    const fingerprint = `${scheduleId}|${participants}`;
    if (fingerprintRef.current !== fingerprint || !idempotencyKeyRef.current) {
      fingerprintRef.current = fingerprint;
      idempotencyKeyRef.current = newIdempotencyKey();
    }

    const idempotencyKey = idempotencyKeyRef.current;
    setMessage(undefined);

    startTransition(async () => {
      const result = await createTourBookingRealAction({
        tourScheduleId: scheduleId,
        participants,
        idempotencyKey
      });

      if (!result.ok) {
        setMessage(resultMessage(result.code, result.message));
        return;
      }

      setBookingId(result.bookingId);
      setMessage("Бронь тура создана. Цена и количество мест подтверждены системой.");
    });
  }

  return (
    <Card className="lg:sticky lg:top-24 lg:shadow-soft">
      <CardHeader>
        <CardTitle>Забронировать тур</CardTitle>
        <CardDescription>
          Свободные места и итоговую стоимость подтверждает база данных в момент бронирования.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={submit}>
          <label className="block space-y-2 text-sm font-medium">
            <span>Дата и время</span>
            <Select
              disabled={!hasSchedules || isPending || Boolean(bookingId)}
              onChange={(event) => setScheduleId(event.target.value)}
              value={scheduleId}
            >
              {schedules.map((schedule) => (
                <option key={schedule.id} value={schedule.id}>
                  {schedule.date}{schedule.startTime ? ` · ${schedule.startTime}` : ""} · свободно {Math.max(schedule.capacity - schedule.bookedSeats, 0)}
                </option>
              ))}
            </Select>
          </label>

          <label className="block space-y-2 text-sm font-medium">
            <span>Участников</span>
            <Input
              disabled={isPending || Boolean(bookingId)}
              max={remaining || undefined}
              min={1}
              onChange={(event) => setParticipants(Number(event.target.value))}
              required
              type="number"
              value={participants}
            />
          </label>

          <div className="rounded-md border border-border bg-background p-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted">Цена за участника</span>
              <span className="font-semibold">{tour.price} {tour.currency}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-muted">Публично свободно сейчас</span>
              <span className="font-semibold">{remaining}</span>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted">
              Итог не принимается от браузера: сервер повторно проверяет расписание, места и цену.
            </p>
          </div>

          {message ? (
            <div
              className={`rounded-md border p-3 text-sm ${bookingId ? "border-success/30 bg-success/5 text-success" : "border-border bg-background text-foreground"}`}
              role="status"
            >
              <p>{message}</p>
              {!bookingId && message.includes("войдите") ? (
                <Link className="mt-2 inline-block font-semibold text-primary hover:underline" href={`/login?next=${encodeURIComponent(`/tours/${tour.slug}`)}`}>
                  Войти в KÖL
                </Link>
              ) : null}
              {bookingId ? <p className="mt-1 text-xs">Booking ID: {bookingId}</p> : null}
            </div>
          ) : null}

          <Button className="w-full" disabled={!hasSchedules || isPending || Boolean(bookingId)} type="submit">
            {bookingId ? "Бронь создана" : isPending ? "Проверяем места…" : "Забронировать"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
