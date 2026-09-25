import type { Tour } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardFooter } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { tourImage } from "@/lib/presentation-media";

type TourCardProps = {
  tour: Tour;
  availabilityLabel?: string;
  className?: string;
};

export function TourCard({ tour, availabilityLabel = "Места доступны", className }: TourCardProps) {
  return (
    <Card className={cn("group overflow-hidden transition duration-200 hover:-translate-y-1 hover:shadow-soft", className)}>
      <div
        className="flex aspect-[4/3] items-end bg-cover bg-center p-4 text-white"
        role="img"
        aria-label={`${tour.title}, ${tour.location}`}
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(2, 20, 35, 0.05), rgba(2, 20, 35, 0.76)), url("${tourImage(tour)}")`
        }}
      >
        <Badge className="border-white/40 bg-white text-primary">{tour.status}</Badge>
      </div>
      <CardContent className="space-y-4 p-5">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">{tour.location}</Badge>
            <Badge variant="muted">{tour.duration}</Badge>
          </div>
          <h3 className="text-lg font-semibold leading-7 transition group-hover:text-primary">{tour.title}</h3>
          <p className="line-clamp-2 text-sm leading-6 text-muted">{tour.description}</p>
        </div>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-muted">Цена</p>
            <p className="text-xl font-semibold">
              {tour.price} {tour.currency}
            </p>
          </div>
          <div className="text-right text-sm text-muted">
            <p>★ {tour.rating}</p>
            <p>{availabilityLabel}</p>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <a
          className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-primary bg-primary px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(15,143,140,0.22)] transition hover:shadow-[0_10px_24px_rgba(15,143,140,0.28)]"
          href={`/tours/${tour.slug}`}
        >
          Забронировать
        </a>
      </CardFooter>
    </Card>
  );
}
