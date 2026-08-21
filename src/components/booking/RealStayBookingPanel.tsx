"use client";

import Link from "next/link";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { createStayBookingRealAction } from "@/app/actions/client/clientBookingsReal";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { Room, Stay } from "@/types";

function newIdempotencyKey() {
  return `kol-stay-${globalThis.crypto.randomUUID()}`;
}

function resultMessage(code: string | undefined, fallback: string) {
  switch (code) {
    case "not_authenticated":
    case "not_authorized":
      return "Для бронирования войдите в аккаунт KÖL.";
    case "invalid_dates":
      return "Проверьте даты заезда и выезда.";
    case "invalid_guests_count":
      return "Проверьте количество гостей.";
    case "booking_rejected":
      return "Выбранный номер или даты уже недоступны. Обновите выбор и попробуйте снова.";
    case "supabase_not_configured":
      return "Онлайн-бронирование временно недоступно.";
    default:
      return fallback;
  }
}

export function RealStayBookingPanel({ stay, rooms }: { stay: Stay; rooms: Room[] }) {
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? "");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [guestsCount, setGuestsCount] = useState(1);
  const [message, setMessage] = useState<string>();
  const [bookingId, setBookingId] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const fingerprintRef = useRef<string>();
  const idempotencyKeyRef = useRef<string>();

  const selectedRoom = rooms.find((room) => room.id === roomId) ?? rooms[0];
  const hasRooms = rooms.length > 0;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBookingId(undefined);

    if (!roomId || !startDate || !endDate || guestsCount < 1) {
      setMessage("Выберите номер, даты и количество гостей.");
      return;
    }

    const fingerprint = `${roomId}|${startDate}|${endDate}|${guestsCount}`;
    if (fingerprintRef.current !== fingerprint || !idempotencyKeyRef.current) {
      fingerprintRef.current = fingerprint;
      idempotencyKeyRef.current = newIdempotencyKey();
    }

    const idempotencyKey = idempotencyKeyRef.current;
    setMessage(undefined);

    startTransition(async () => {
      const result = await createStayBookingRealAction({
        roomId,
        startDate,
        endDate,
        guestsCount,
        idempotencyKey
      });

      if (!result.ok) {
        setMessage(resultMessage(result.code, result.message));
        return;
      }

      setBookingId(result.bookingId);
      setMessage("Бронь создана. Цена и доступность подтверждены системой.");
    });
  }

  return (
    <Card className="lg:sticky lg:top-24 lg:shadow-soft">
      <CardHeader>
        <CardTitle>Забронировать жильё</CardTitle>
        <CardDescription>
          Доступность и итоговую стоимость проверяет база данных в момент бронирования.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={submit}>
          <label className="block space-y-2 text-sm font-medium">
            <span>Номер</span>
            <Select
              disabled={!hasRooms || isPending || Boolean(bookingId)}
              onChange={(event) => setRoomId(event.target.value)}
              value={roomId}
            >
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.title} · до {room.capacity} гостей
                </option>
              ))}
            </Select>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-2 text-sm font-medium">
              <span>Заезд</span>
              <Input
                disabled={isPending || Boolean(bookingId)}
                onChange={(event) => setStartDate(event.target.value)}
                required
                type="date"
                value={startDate}
              />
            </label>
            <label className="block space-y-2 text-sm font-medium">
              <span>Выезд</span>
              <Input
                disabled={isPending || Boolean(bookingId)}
                min={startDate || undefined}
                onChange={(event) => setEndDate(event.target.value)}
                required
                type="date"
                value={endDate}
              />
            </label>
          </div>

          <label className="block space-y-2 text-sm font-medium">
            <span>Гостей</span>
            <Input
              disabled={isPending || Boolean(bookingId)}
              max={selectedRoom?.capacity}
              min={1}
              onChange={(event) => setGuestsCount(Number(event.target.value))}
              required
              type="number"
              value={guestsCount}
            />
          </label>

          <div className="rounded-md border border-border bg-background p-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted">Базовая цена номера</span>
              <span className="font-semibold">
                {selectedRoom?.pricePerNight ?? stay.minPricePerNight} {stay.currency} / ночь
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted">
              Это не передаваемый в бронь итог. Сервер сам рассчитывает сумму по датам и ценовым корректировкам.
            </p>
          </div>

          {message ? (
            <div
              className={`rounded-md border p-3 text-sm ${bookingId ? "border-success/30 bg-success/5 text-success" : "border-border bg-background text-foreground"}`}
              role="status"
            >
              <p>{message}</p>
              {!bookingId && message.includes("войдите") ? (
                <Link className="mt-2 inline-block font-semibold text-primary hover:underline" href={`/login?next=${encodeURIComponent(`/stays/${stay.slug}`)}`}>
                  Войти в KÖL
                </Link>
              ) : null}
              {bookingId ? <p className="mt-1 text-xs">Booking ID: {bookingId}</p> : null}
            </div>
          ) : null}

          <Button className="w-full" disabled={!hasRooms || isPending || Boolean(bookingId)} type="submit">
            {bookingId ? "Бронь создана" : isPending ? "Проверяем доступность…" : "Забронировать"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
