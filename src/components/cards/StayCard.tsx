import type { Room, Stay } from "@/types";
import Image from "next/image";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardFooter } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { stayImage, stayLogo } from "@/lib/presentation-media";

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
  const logo = stayLogo(stay);

  return (
    <a aria-label={`Открыть объект: ${stay.title}`} className={cn("group block", className)} href={`/stays/${stay.slug}`}>
      <Card className="h-full overflow-hidden rounded-[1.5rem] border-slate-200/80 bg-white transition duration-300 group-hover:-translate-y-1.5 group-hover:shadow-[0_22px_50px_rgba(7,28,44,0.13)]">
        <div
          className="relative flex aspect-[16/11] items-end bg-cover bg-center p-4 text-white"
          role="img"
          aria-label={`${stay.title}, ${stay.location}`}
          style={{
            backgroundImage: `linear-gradient(180deg, rgba(2, 20, 35, 0.08), rgba(2, 20, 35, 0.72)), url("${stayImage(stay)}")`
          }}
        >
          {logo ? <Image alt={`${stay.title} — логотип`} className="absolute right-3 top-3 h-11 w-16 rounded-lg bg-white/95 object-contain p-1 shadow-sm" height={80} src={logo} width={112} /> : null}
          <Badge className="border-white/40 bg-white text-secondary">{stayTypeLabels[stay.type]}</Badge>
        </div>
        <CardContent className="space-y-4 p-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info">{stay.location}</Badge>
              <Badge variant="muted">Партнёр KÖL</Badge>
            </div>
            <h3 className="text-lg font-semibold leading-7 transition group-hover:text-primary">{stay.title}</h3>
            <p className="line-clamp-3 text-sm leading-6 text-muted">{stay.description}</p>
          </div>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-muted">Стоимость от</p>
              <p className="text-xl font-semibold">
                {stay.minPricePerNight > 0 ? `${stay.minPricePerNight.toLocaleString("ru-RU")} ${stay.currency}` : "Цена по запросу"}
              </p>
            </div>
            <div className="text-right text-sm text-muted">
              <p>{stay.rating > 0 ? `★ ${stay.rating}` : "Рейтинг уточняется"}</p>
              <p>{room ? `до ${room.capacity} гостей` : "Категории уточняются"}</p>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <span className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-primary bg-primary px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(15,143,140,0.22)] transition group-hover:shadow-[0_10px_24px_rgba(15,143,140,0.28)]">
            Открыть описание и номера
          </span>
        </CardFooter>
      </Card>
    </a>
  );
}
