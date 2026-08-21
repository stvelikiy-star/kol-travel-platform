import type { PartnerBusiness, PartnerType } from "@/types";
import type { PublicPartnerBusiness } from "@/lib/data/public-partners-supabase";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Card, CardContent, CardFooter } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

const partnerTypeLabels: Record<PartnerType, string> = {
  hotel: "Отель",
  guest_house: "Гостевой дом",
  restaurant: "Ресторан",
  cafe: "Кафе",
  shop: "Магазин",
  tour_operator: "Туроператор",
  guide: "Гид",
  delivery_service: "Служба доставки",
  alcohol_partner: "Alcohol partner"
};

const businessStatusVariants: Record<PartnerBusiness["businessStatus"], BadgeVariant> = {
  online: "success",
  paused: "warning",
  offline: "muted"
};

type PartnerCardProps = {
  partner: PublicPartnerBusiness;
  className?: string;
};

export function PartnerCard({ partner, className }: PartnerCardProps) {
  const detailHref =
    partner.type === "restaurant" || partner.type === "cafe"
      ? `/food/${partner.slug}`
      : partner.type === "shop"
        ? `/shop/${partner.slug}`
        : partner.type === "hotel" || partner.type === "guest_house"
          ? "/stays"
          : "/tours";

  return (
    <Card className={cn("group overflow-hidden transition duration-200 hover:-translate-y-1 hover:shadow-soft", className)}>
      <div className="flex aspect-[4/3] items-end bg-gradient-to-br from-primary via-aqua to-sand p-4">
        <Badge variant={businessStatusVariants[partner.businessStatus]}>
          {partner.businessStatus}
        </Badge>
      </div>
      <CardContent className="space-y-4 p-5">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">{partnerTypeLabels[partner.type]}</Badge>
            <Badge variant="muted">{partner.location}</Badge>
          </div>
          <h3 className="text-lg font-semibold leading-7 transition group-hover:text-primary">{partner.title}</h3>
          <p className="line-clamp-2 text-sm leading-6 text-muted">{partner.description}</p>
        </div>
        <div className="flex items-center justify-between gap-4 text-sm text-muted">
          <span>★ {partner.rating}</span>
          <span>{partner.status}</span>
        </div>
      </CardContent>
      <CardFooter>
        <a
          className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:border-primary hover:bg-lake-light hover:text-primary"
          href={detailHref}
        >
          Открыть
        </a>
      </CardFooter>
    </Card>
  );
}
