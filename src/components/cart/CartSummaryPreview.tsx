import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

type CartSummaryPreviewProps = {
  itemCount: number;
  subtotal: number;
  currency?: "KGS";
  className?: string;
};

export function CartSummaryPreview({
  itemCount,
  subtotal,
  currency = "KGS",
  className
}: CartSummaryPreviewProps) {
  return (
    <Card className={cn("lg:sticky lg:top-24 lg:shadow-soft", className)}>
      <CardHeader>
        <CardTitle>Ваш заказ</CardTitle>
        <CardDescription>Проверьте выбранные позиции перед оформлением.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 rounded-md border border-border/80 bg-background p-4 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted">Позиции</span>
            <span className="font-semibold">{itemCount}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted">Стоимость товаров</span>
            <span className="font-semibold">{subtotal} {currency}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted">Получение / доставка</span>
            <span className="font-semibold">Рассчитывается при оформлении</span>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
            <span className="font-semibold">Предварительная сумма</span>
            <span className="text-lg font-semibold">{subtotal} {currency}</span>
          </div>
        </div>
        <Button className="w-full">Перейти к оформлению</Button>
        <p className="text-xs leading-5 text-muted">
          Итоговая сумма зависит от способа получения и подтверждается перед созданием заказа.
        </p>
      </CardContent>
    </Card>
  );
}
