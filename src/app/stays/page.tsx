import { CatalogSection } from "@/components/catalog/CatalogSection";
import { CatalogToolbar } from "@/components/catalog/CatalogToolbar";
import { EmptyState } from "@/components/catalog/EmptyState";
import { StayCard } from "@/components/cards/StayCard";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Container } from "@/components/ui/Container";
import { getRooms } from "@/lib/data/catalog";
import { getPublicStaysReadResult } from "@/lib/data/public-stays-read";

const locationOptions = [
  { label: "Чолпон-Ата", value: "cholpon-ata" },
  { label: "Бостери", value: "bosteri" },
  { label: "Каракол", value: "karakol" },
  { label: "Тамчы", value: "tamchy" },
  { label: "Бактуу-Долоноту", value: "baktuu-dolonotu" }
];

export default async function StaysPage() {
  const readResult = await getPublicStaysReadResult();
  const stays = readResult.items;
  const rooms = getRooms();
  const isEmpty = stays.length === 0;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <Container className="py-10">
        <CatalogSection
          description="От гостевых домов до премиум-вилл, коттеджей и юрточных лагерей по всему Иссык-Кулю."
          emptyState={
            <EmptyState
              actionLabel="Сбросить фильтры"
              description="Попробуйте изменить локацию, даты, гостей или тип жилья."
              title="Жильё не найдено"
            />
          }
          isEmpty={isEmpty}
          title="Жильё и ночлег"
          toolbar={
            <CatalogToolbar
              categoryLabel="Тип жилья"
              categoryOptions={[
                { label: "Гостевой дом", value: "guest-house" },
                { label: "Отель", value: "hotel" },
                { label: "Коттедж", value: "cottage" },
                { label: "Юрточный лагерь", value: "yurt-camp" },
                { label: "Вилла", value: "villa" }
              ]}
              locationOptions={locationOptions}
              resultCount={stays.length}
              searchPlaceholder="Название жилья"
              sortOptions={[
                { label: "Рекомендуемые", value: "recommended" },
                { label: "Цена за ночь ↑", value: "price-asc" },
                { label: "Цена за ночь ↓", value: "price-desc" },
                { label: "Рейтинг", value: "rating" }
              ]}
            />
          }
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {stays.map((stay, index) => (
              <StayCard key={stay.id} room={rooms[index]} stay={stay} />
            ))}
          </div>
        </CatalogSection>
      </Container>
      <PublicFooter />
    </main>
  );
}
