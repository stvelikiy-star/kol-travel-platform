import type { ProductStatus } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";

type AddToCartPanelProps = {
  title: string;
  price: number;
  currency: "KGS";
  status: ProductStatus;
  quantity?: number;
  className?: string;
};

const statusLabel: Record<ProductStatus, string> = {
  active: "В наличии",
  out_of_stock: "Нет в наличии",
  stopped: "Временно недоступно"
};

export function AddToCartPanel({
  title,
  price,
  currency,
  status,
  quantity = 1,
  className
}: AddToCartPanelProps) {
  const isDisabled = status === "out_of_stock" || status === "stopped";
  const total = price * quantity;

  return (
    <Card className={cn("border-border/90 shadow-card", className)}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>
          Выберите количество. Наличие перепроверяется перед оформлением заказа.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input defaultValue={quantity} min={1} placeholder="Количество" type="number" />
        <div className="grid gap-2 rounded-md border border-border/80 bg-background p-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted">Цена</span>
            <span className="font-semibold">{price} {currency}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted">Предварительно</span>
            <span className="font-semibold">{total} {currency}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted">Наличие</span>
            <Badge variant={isDisabled ? "danger" : "success"}>{statusLabel[status]}</Badge>
          </div>
        </div>
        <Button className="w-full" disabled={isDisabled}>
          {isDisabled ? "Недоступно" : "Добавить в корзину"}
        </Button>
      </CardContent>
    </Card>
  );
}
