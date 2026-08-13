import type { FoodItem } from "@/types";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Card, CardContent, CardFooter } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

const statusVariants: Record<FoodItem["status"], BadgeVariant> = {
  active: "success",
  out_of_stock: "warning",
  hidden: "muted",
  stopped: "danger",
  under_review: "info"
};

type FoodCardProps = {
  food: FoodItem;
  partnerName: string;
  partnerSlug?: string;
  prepTime?: string;
  className?: string;
};

export function FoodCard({
  food,
  partnerName,
  partnerSlug,
  prepTime = "25-35 мин",
  className
}: FoodCardProps) {
  return (
    <Card className={cn("group overflow-hidden transition duration-200 hover:-translate-y-1 hover:shadow-soft", className)}>
      <div className="flex aspect-[4/3] items-end bg-gradient-to-br from-sand via-teal to-lake p-4">
        <Badge variant={statusVariants[food.status]}>{food.status}</Badge>
      </div>
      <CardContent className="space-y-4 p-5">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="muted">{food.category}</Badge>
            <Badge variant="info">{prepTime}</Badge>
          </div>
          <h3 className="text-lg font-semibold leading-7 transition group-hover:text-primary">{food.title}</h3>
          <p className="text-sm font-medium text-muted">{partnerName}</p>
          <p className="line-clamp-2 text-sm leading-6 text-muted">{food.description}</p>
        </div>
        <p className="text-xl font-semibold">
          {food.price} {food.currency}
        </p>
      </CardContent>
      <CardFooter>
        <a
          className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-primary bg-primary px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(15,143,140,0.22)] transition hover:shadow-[0_10px_24px_rgba(15,143,140,0.28)] aria-disabled:pointer-events-none aria-disabled:opacity-50"
          aria-disabled={food.status !== "active"}
          href={partnerSlug ? `/food/${partnerSlug}` : "#"}
        >
          В корзину
        </a>
      </CardFooter>
    </Card>
  );
}
