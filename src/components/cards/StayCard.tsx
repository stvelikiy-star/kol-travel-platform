import type { Room, Stay } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardFooter } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

const stayTypeLabels: Record<Stay["type"], string> = {
  guest_house: "Гостевой дом",
  hotel: "Отель",
  cottage: "Коттедж",
  yurt_camp: "Юрточный лагерь",
  villa: "Вилла"
};

type StayCardProps = {
  stay: Stay;
  room?: Room;
  className?: string;
};

export function StayCard({ stay, room, className }: StayCardProps) {
  return (
    <Card className={cn("group overflow-hidden transition duration-200 hover:-translate-y-1 hover:shadow-soft", className)}>
      <div className="flex aspect-[4/3] items-end bg-gradient-to-br from-lake via-teal to-sand p-4 text-white">
        <Badge className="border-white/40 bg-white text-secondary">{stayTypeLabels[stay.type]}</Badge>
      </div>
      <CardContent className="space-y-4 p-5">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">{stay.location}</Badge>
            <Badge variant="muted">{stay.status}</Badge>
          </div>
          <h3 className="text-lg font-semibold leading-7 transition group-hover:text-primary">{stay.title}</h3>
          <p className="line-clamp-2 text-sm leading-6 text-muted">{stay.description}</p>
        </div>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-muted">За ночь</p>
            <p className="text-xl font-semibold">
              от {stay.minPricePerNight} {stay.currency}
            </p>
          </div>
          <div className="text-right text-sm text-muted">
            <p>★ {stay.rating}</p>
            <p>{room ? `до ${room.capacity} гостей` : "вместимость уточняется"}</p>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <a
          className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-primary bg-primary px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(15,143,140,0.22)] transition hover:shadow-[0_10px_24px_rgba(15,143,140,0.28)]"
          href={`/stays/${stay.slug}`}
        >
          Выбрать номер
        </a>
      </CardFooter>
    </Card>
  );
}
