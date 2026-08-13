import { ClientLayout } from "@/components/layout/ClientLayout";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";

const offers = [
  { title: "Тур выходного дня", description: "Скидка на катер и экскурсии по Чолпон-Ате.", discount: "-10%", status: "active", href: "/tours" },
  { title: "Жильё 3+ ночи", description: "Промо для гостевых домов и коттеджей.", discount: "-15%", status: "demo", href: "/stays" },
  { title: "Завтрак у озера", description: "Скидка на доставку завтраков в Тамчы.", discount: "-200 KGS", status: "active", href: "/food" },
  { title: "Магазин для отдыха", description: "Demo-скидка на товары для пляжа и пикника.", discount: "KOLSHOP", status: "demo", href: "/shop" },
  { title: "Сезонный промокод", description: "Истёкший пример для будущей валидации.", discount: "KOLSUMMER", status: "expired", href: "/client/offers" }
];

export default function ClientOffersPage() {
  return (
    <ClientLayout>
      <Card>
        <CardHeader>
          <Badge className="w-fit" variant="info">Offers</Badge>
          <CardTitle className="text-2xl">Мои офферы</CardTitle>
          <CardDescription>Промокоды, скидки и demo-предложения на туры, жильё, еду и магазин.</CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {offers.map((offer) => (
          <Card key={offer.title}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>{offer.title}</CardTitle>
                  <CardDescription>{offer.description}</CardDescription>
                </div>
                <Badge variant={offer.status === "active" ? "success" : offer.status === "expired" ? "muted" : "info"}>
                  {offer.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-primary">{offer.discount}</p>
            </CardContent>
            <CardFooter>
              <Button disabled={offer.status === "expired"} variant={offer.status === "expired" ? "outline" : "primary"}>
                Применить demo
              </Button>
              <a className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:border-primary hover:text-primary" href={offer.href}>
                Открыть раздел
              </a>
            </CardFooter>
          </Card>
        ))}
      </div>
    </ClientLayout>
  );
}
