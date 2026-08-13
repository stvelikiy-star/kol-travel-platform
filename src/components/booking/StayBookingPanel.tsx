import type { Room, Stay } from "@/types";
import { Button } from "@/components/ui/Button";
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

export function StayBookingPanel({
  stay,
  rooms = [],
  guests = 2,
  nights = 2,
  className
}: StayBookingPanelProps) {
  const selectedRoom = rooms[0];
  const pricePerNight = selectedRoom?.pricePerNight ?? stay.minPricePerNight;
  const total = pricePerNight * nights;

  return (
    <Card className={cn("lg:sticky lg:top-24 lg:shadow-soft", className)}>
      <CardHeader>
        <CardTitle>Бронирование жилья</CardTitle>
        <CardDescription>
          Проверка доступности будет подключена позже через RoomAvailability.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input placeholder="Дата заезда" />
          <Input placeholder="Дата выезда" />
        </div>
        <Input defaultValue={guests} min={1} placeholder="Количество гостей" type="number" />
        <Select defaultValue={selectedRoom?.id ?? "standard"}>
          {rooms.length > 0 ? (
            rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.title}
              </option>
            ))
          ) : (
            <option value="standard">Тип номера уточняется</option>
          )}
        </Select>
        <div className="grid gap-3 rounded-md border border-border/80 bg-background p-4 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted">Цена за ночь</span>
            <span className="font-semibold">
              {pricePerNight} {stay.currency}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted">Итого placeholder</span>
            <span className="text-lg font-semibold">
              {total} {stay.currency}
            </span>
          </div>
        </div>
        <a
          className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-primary bg-primary px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(15,143,140,0.22)] transition hover:shadow-[0_10px_24px_rgba(15,143,140,0.28)]"
          href="/booking/checkout"
        >
          Забронировать жильё
        </a>
      </CardContent>
    </Card>
  );
}
