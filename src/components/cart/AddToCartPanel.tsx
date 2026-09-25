import type { ProductStatus } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

type AddToCartPanelProps = {
  title: string;
  businessId?: string;
  itemId?: string;
  itemType?: "food" | "product";
  price: number;
  currency: "KGS";
  status: ProductStatus;
  partnerName?: string;
  kind?: "food" | "product";
  className?: string;
};

export function AddToCartPanel({ title, price, currency, status, partnerName = "", kind = "product", className }: AddToCartPanelProps) {
  const isDisabled = status === "out_of_stock" || status === "stopped";
  const query = new URLSearchParams({ item: title, kind, price: String(price), currency, ...(partnerName ? { partner: partnerName } : {}) }).toString();

  return (
    <Card className={cn("border-border/90 shadow-card", className)}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>Отправьте заявку. Оператор подтвердит наличие, цену и способ получения.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 rounded-md border border-border/80 bg-background p-3 text-sm">
          <div className="flex items-center justify-between gap-3"><span className="text-muted">Цена в каталоге</span><span className="font-semibold">{price} {currency}</span></div>
          <div className="flex items-center justify-between gap-3"><span className="text-muted">Статус</span><Badge variant={isDisabled ? "danger" : "success"}>{status}</Badge></div>
        </div>
        {isDisabled ? (
          <span className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-semibold text-muted opacity-70">Сейчас недоступно</span>
        ) : (
          <a className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-primary bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90" href={`/checkout?${query}`}>Оставить заявку</a>
        )}
      </CardContent>
    </Card>
  );
}
