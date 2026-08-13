import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

type CartSummaryPreviewProps = {
  itemCount: number;
  subtotal: number;
  deliveryFee?: number;
  currency?: "KGS";
  className?: string;
};

export function CartSummaryPreview({
  itemCount,
  subtotal,
  deliveryFee = 150,
  currency = "KGS",
  className
}: CartSummaryPreviewProps) {
  const total = subtotal + deliveryFee;

  return (
    <Card className={cn("lg:sticky lg:top-24 lg:shadow-soft", className)}>
      <CardHeader>
        <CardTitle>Demo cart</CardTitle>
        <CardDescription>Мини-корзина без реального cart state.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 rounded-md border border-border/80 bg-background p-4 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted">Позиции</span>
            <span className="font-semibold">{itemCount}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted">Subtotal</span>
            <span className="font-semibold">
              {subtotal} {currency}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted">Delivery placeholder</span>
            <span className="font-semibold">
              {deliveryFee} {currency}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
            <span className="font-semibold">Total</span>
            <span className="text-lg font-semibold">
              {total} {currency}
            </span>
          </div>
        </div>
        <Button className="w-full">Перейти к оформлению</Button>
      </CardContent>
    </Card>
  );
}
