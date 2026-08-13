import { ClientLayout } from "@/components/layout/ClientLayout";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { readClientFavorites } from "@/lib/data/client-favorites-read";
import type { ClientFavoriteItem, ClientFavoriteKind } from "@/lib/types/client-favorites";

export default async function ClientFavoritesPage() {
  const favorites = await readClientFavorites();
  const isMock = favorites.source === "mock";
  const isUnavailable = favorites.status === "unavailable";
  const itemsFor = (kind: ClientFavoriteKind) => favorites.items.filter((item) => item.kind === kind);

  return (
    <ClientLayout>
      <Card>
        <CardHeader>
          <Badge className="w-fit" variant="info">Favorites</Badge>
          <CardTitle className="text-2xl">Избранное</CardTitle>
          <CardDescription>
            {isMock
              ? "Demo-подборка сохранённых туров, жилья, блюд и товаров."
              : isUnavailable
                ? "Избранное сейчас недоступно. Попробуйте снова позже."
                : "Ваши сохранённые туры, жильё, блюда и товары."}
          </CardDescription>
        </CardHeader>
      </Card>

      <FavoriteSection
        actionHref="/tours"
        actionLabel="Смотреть туры"
        emptyDescription={emptyDescription(isMock, isUnavailable, "Сохранённых туров пока нет.")}
        items={itemsFor("tour")}
        sourceDescription={sectionDescription(isMock, isUnavailable)}
        title="Избранные туры"
      />

      <FavoriteSection
        actionHref="/stays"
        actionLabel="Смотреть жильё"
        emptyDescription={emptyDescription(isMock, isUnavailable, "Сохранённых вариантов жилья пока нет.")}
        items={itemsFor("stay")}
        sourceDescription={sectionDescription(isMock, isUnavailable)}
        title="Избранное жильё"
      />

      <FavoriteSection
        actionHref="/food"
        actionLabel="Смотреть еду"
        emptyDescription={emptyDescription(isMock, isUnavailable, "Сохранённых ресторанов и блюд пока нет.")}
        items={itemsFor("food")}
        sourceDescription={sectionDescription(isMock, isUnavailable)}
        title="Избранные рестораны и блюда"
      />

      <FavoriteSection
        actionHref="/shop"
        actionLabel="Смотреть магазин"
        emptyDescription={emptyDescription(isMock, isUnavailable, "Сохранённых товаров пока нет.")}
        items={itemsFor("product")}
        sourceDescription={sectionDescription(isMock, isUnavailable)}
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
  sourceDescription,
  title
}: {
  actionHref: string;
  actionLabel: string;
  emptyDescription: string;
  items: ClientFavoriteItem[];
  sourceDescription: string;
  title: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{sourceDescription}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        {items.length > 0 ? (
          items.map((item) => (
            <a className="block rounded-lg border border-border bg-background p-4 transition hover:border-primary" href={item.href} key={item.id}>
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

function sectionDescription(isMock: boolean, isUnavailable: boolean): string {
  if (isMock) return "Данные взяты из mock data. Реальное избранное появится после auth.";
  if (isUnavailable) return "Не удалось безопасно загрузить данные из Supabase.";
  return "Данные загружены из вашего аккаунта.";
}

function emptyDescription(isMock: boolean, isUnavailable: boolean, emptyText: string): string {
  if (isMock) return `После auth ${emptyText.toLowerCase()}`;
  if (isUnavailable) return "Данные сейчас недоступны.";
  return emptyText;
}
