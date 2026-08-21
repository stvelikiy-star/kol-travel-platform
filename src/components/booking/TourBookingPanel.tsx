import type { Tour, TourSchedule } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/cn";

type TourBookingPanelProps = {
  tour: Tour;
  schedules?: TourSchedule[];
  guests?: number;
  className?: string;
};

export function TourBookingPanel({
  tour,
  schedules = [],
  guests = 2,
  className
}: TourBookingPanelProps) {
  const selectedSchedule = schedules[0];
  const availableSeats = selectedSchedule
    ? Math.max(selectedSchedule.capacity - selectedSchedule.bookedSeats, 0)
    : 0;
  const total = tour.price * guests;
  const isAvailable = !selectedSchedule || selectedSchedule.status === "available";

  return (
    <Card className={cn("lg:sticky lg:top-24 lg:shadow-soft", className)}>
      <CardHeader>
        <CardTitle>Бронирование тура</CardTitle>
        <CardDescription>Выберите удобную дату и количество участников.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select defaultValue={selectedSchedule?.id ?? "manual"}>
          {schedules.length > 0 ? (
            schedules.map((schedule) => (
              <option key={schedule.id} value={schedule.id}>
                {schedule.date} · {schedule.startTime}
              </option>
            ))
          ) : (
            <option value="manual">Дата уточняется</option>
          )}
        </Select>
        <Input defaultValue={guests} min={1} placeholder="Количество участников" type="number" />
        <div className="grid gap-3 rounded-md border border-border/80 bg-background p-4 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted">Цена за участника</span>
            <span className="font-semibold">
              {tour.price} {tour.currency}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted">Предварительно</span>
            <span className="text-lg font-semibold">
              {total} {tour.currency}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted">Доступность</span>
            <Badge variant={isAvailable ? "success" : "warning"}>
              {selectedSchedule ? `${availableSeats} мест` : "по запросу"}
            </Badge>
          </div>
        </div>
        <a
          className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-primary bg-primary px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(15,143,140,0.22)] transition hover:shadow-[0_10px_24px_rgba(15,143,140,0.28)]"
          href="/booking/checkout"
        >
          Продолжить бронирование
        </a>
        <p className="text-xs leading-5 text-muted">
          Финальная стоимость и количество свободных мест подтверждаются перед оформлением.
        </p>
      </CardContent>
    </Card>
  );
}
