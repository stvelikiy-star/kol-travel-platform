"use client";

import { useMemo, useState } from "react";
import type { Room, Stay } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/cn";

type StayBookingPanelProps = {
  stay: Stay;
  rooms?: Room[];
  guests?: number;
  nights?: number;
  className?: string;
};

function nightsBetween(startDate: string, endDate: string, fallback: number) {
  if (!startDate || !endDate || endDate <= startDate) return fallback;
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return fallback;
  return Math.max(Math.round((end - start) / 86_400_000), 1);
}

export function StayBookingPanel({
  stay,
  rooms = [],
  guests = 2,
  nights = 2,
  className
}: StayBookingPanelProps) {
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? "standard");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [guestsCount, setGuestsCount] = useState(guests);

  const selectedRoom = rooms.find((room) => room.id === roomId) ?? rooms[0];
  const pricePerNight = selectedRoom?.pricePerNight ?? stay.minPricePerNight;
  const selectedNights = useMemo(() => nightsBetween(startDate, endDate, nights), [startDate, endDate, nights]);
  const total = pricePerNight * selectedNights;
  const invalidGuests = Boolean(selectedRoom && guestsCount > selectedRoom.capacity);

  return (
    <Card className={cn("lg:sticky lg:top-24 lg:shadow-soft", className)}>
      <CardHeader>
        <CardTitle>Бронирование жилья</CardTitle>
        <CardDescription>
          Выберите даты, количество гостей и подходящий вариант размещения.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action="/booking/checkout" className="space-y-4" method="get">
          <input name="bookingType" type="hidden" value="stay" />
          <input name="stayId" type="hidden" value={stay.id} />

          <div className="grid gap-3 sm:grid-cols-2">
            <Input aria-label="Дата заезда" name="startDate" onChange={(event) => setStartDate(event.target.value)} required type="date" value={startDate} />
            <Input aria-label="Дата выезда" min={startDate || undefined} name="endDate" onChange={(event) => setEndDate(event.target.value)} required type="date" value={endDate} />
          </div>

          <Input aria-label="Количество гостей" max={selectedRoom?.capacity} min={1} name="guests" onChange={(event) => setGuestsCount(Number(event.target.value))} required type="number" value={guestsCount} />

          <Select name="roomId" onChange={(event) => setRoomId(event.target.value)} value={roomId}>
            {rooms.length > 0 ? rooms.map((room) => (
              <option key={room.id} value={room.id}>{room.title} · до {room.capacity} гостей</option>
            )) : <option value="standard">Вариант размещения уточняется</option>}
          </Select>

          <div className="grid gap-3 rounded-md border border-border/80 bg-background p-4 text-sm">
            <div className="flex items-center justify-between gap-3"><span className="text-muted">Цена за ночь</span><span className="font-semibold">{pricePerNight} {stay.currency}</span></div>
            <div className="flex items-center justify-between gap-3"><span className="text-muted">Предварительно за {selectedNights} ноч.</span><span className="text-lg font-semibold">{total} {stay.currency}</span></div>
          </div>

          {invalidGuests ? <p className="rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-danger" role="alert">Выбранный номер рассчитан максимум на {selectedRoom?.capacity} гостей.</p> : null}

          <button className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-primary bg-primary px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(15,143,140,0.22)] transition hover:shadow-[0_10px_24px_rgba(15,143,140,0.28)] disabled:pointer-events-none disabled:opacity-50" disabled={invalidGuests || !startDate || !endDate || endDate <= startDate} type="submit">
            Продолжить бронирование
          </button>
          <p className="text-xs leading-5 text-muted">Выбранные объект, номер, даты и гости будут переданы на следующий шаг. Финальная доступность и стоимость подтверждаются только рабочей системой бронирования.</p>
        </form>
      </CardContent>
    </Card>
  );
}
