import { ClientLayout } from "@/components/layout/ClientLayout";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { getFood, getProducts, getStays, getTours } from "@/lib/data/catalog";

export default function ClientFavoritesPage() {
  const tours = getTours();
  const stays = getStays();
  const foodItems = getFood();
  const products = getProducts();

  return (
    <ClientLayout>
      <Card>
        <CardHeader>
          <Badge className="w-fit" variant="info">Favorites</Badge>
          <CardTitle className="text-2xl">Избранное</CardTitle>
          <CardDescription>Demo-подборка сохранённых туров, жилья, блюд и товаров.</CardDescription>
        </CardHeader>
      </Card>

      <FavoriteSection
        actionHref="/tours"
        actionLabel="Смотреть туры"
        emptyDescription="После auth сохранённые туры будут появляться здесь."
        items={tours.slice(0, 2).map((tour) => ({
          badge: tour.location,
          description: tour.description,
          href: `/tours/${tour.slug}`,
          meta: `${tour.price} ${tour.currency} · ${tour.duration}`,
          title: tour.title
        }))}
        title="Избранные туры"
      />

      <FavoriteSection
        actionHref="/stays"
        actionLabel="Смотреть жильё"
        emptyDescription="После auth сохранённые варианты жилья будут появляться здесь."
        items={stays.slice(0, 2).map((stay) => ({
          badge: stay.location,
          description: stay.description,
          href: `/stays/${stay.slug}`,
          meta: `от ${stay.minPricePerNight} ${stay.currency} · рейтинг ${stay.rating}`,
          title: stay.title
        }))}
        title="Избранное жильё"
      />

      <FavoriteSection
        actionHref="/food"
        actionLabel="Смотреть еду"
        emptyDescription="После auth сохранённые рестораны и блюда будут появляться здесь."
        items={foodItems.slice(0, 1).map((food) => ({
          badge: food.category,
          description: food.description,
          href: "/food/naryn-beshbarmak",
          meta: `${food.price} ${food.currency}`,
          title: food.title
        }))}
        title="Избранные рестораны и блюда"
      />

      <FavoriteSection
        actionHref="/shop"
        actionLabel="Смотреть магазин"
        emptyDescription="После auth сохранённые товары будут появляться здесь."
        items={products.slice(0, 1).map((product) => ({
          badge: product.category,
          description: product.description,
          href: "/shop/sary-oi-market",
          meta: `${product.price} ${product.currency}`,
          title: product.title
        }))}
        title="Избранные товары"
      />
    </ClientLayout>
  );
}

function FavoriteSection({
  actionHref,
  actionLabel,
  emptyDescription,
  items,
  title
}: {
  actionHref: string;
  actionLabel: string;
  emptyDescription: string;
  items: Array<{ badge: string; description: string; href: string; meta: string; title: string }>;
  title: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Данные взяты из mock data. Реальное избранное появится после auth.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        {items.length > 0 ? (
          items.map((item) => (
            <a className="block rounded-lg border border-border bg-background p-4 transition hover:border-primary" href={item.href} key={item.title}>
              <Badge variant="muted">{item.badge}</Badge>
              <p className="mt-3 font-semibold">{item.title}</p>
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">{item.description}</p>
              <p className="mt-3 text-sm font-semibold text-primary">{item.meta}</p>
            </a>
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-background p-5 text-sm text-muted md:col-span-2">
            {emptyDescription}
          </div>
        )}
      </CardContent>
      <CardFooter>
        <a className="inline-flex min-h-11 items-center justify-center rounded-md border border-primary bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90" href={actionHref}>
          {actionLabel}
        </a>
      </CardFooter>
    </Card>
  );
}
