import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardFooter } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

export type Offer = {
  id: string;
  title: string;
  description: string;
  discount: string;
  period: string;
  partnerName: string;
};

type OfferCardProps = {
  offer: Offer;
  className?: string;
};

export function OfferCard({ offer, className }: OfferCardProps) {
  return (
    <Card className={cn("group overflow-hidden transition duration-200 hover:-translate-y-1 hover:shadow-soft", className)}>
      <div className="flex aspect-[4/3] items-end bg-gradient-to-br from-danger via-sand to-teal p-4">
        <Badge className="border-white/40 bg-white text-danger">{offer.discount}</Badge>
      </div>
      <CardContent className="space-y-4 p-5">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">{offer.partnerName}</Badge>
            <Badge variant="muted">{offer.period}</Badge>
          </div>
          <h3 className="text-lg font-semibold leading-7 transition group-hover:text-primary">{offer.title}</h3>
          <p className="line-clamp-3 text-sm leading-6 text-muted">{offer.description}</p>
        </div>
      </CardContent>
      <CardFooter>
        <Button className="w-full" variant="secondary">
          Посмотреть
        </Button>
      </CardFooter>
    </Card>
  );
}
