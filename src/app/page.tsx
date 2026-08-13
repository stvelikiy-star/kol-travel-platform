import { FoodCard } from "@/components/cards/FoodCard";
import { PartnerCard } from "@/components/cards/PartnerCard";
import { ProductCard } from "@/components/cards/ProductCard";
import { StayCard } from "@/components/cards/StayCard";
import { TourCard } from "@/components/cards/TourCard";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { Input } from "@/components/ui/Input";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Select } from "@/components/ui/Select";
import { getFood, getProducts, getRooms, getStays, getTours } from "@/lib/data/catalog";
import { getPartners } from "@/lib/data/partners";

const tours = getTours();
const stays = getStays();
const foodItems = getFood();
const products = getProducts();
const partners = getPartners();
const rooms = getRooms();

const categories = [
  {
    title: "Туры",
    description: "Катера, джип-туры, этно-маршруты и экскурсии.",
    badge: `${tours.length} предложений`
  },
  {
    title: "Жильё",
    description: "Отели, гостевые дома, коттеджи, юрты и виллы.",
    badge: `${stays.length} объектов`
  },
  {
    title: "Еда",
    description: "Рестораны, кафе, завтраки и доставка к месту отдыха.",
    badge: `${foodItems.length} блюд`
  },
  {
    title: "Магазин",
    description: "Продукты, пляжные товары, уголь и сувениры.",
    badge: `${products.length} товаров`
  },
  {
    title: "Акции",
    description: "Сезонные предложения для отдыха и бронирований.",
    badge: "скоро"
  },
  {
    title: "Партнёрам",
    description: "Кабинет, CRM, заказы, брони, аналитика и stop-кнопка.",
    badge: `${partners.length} партнёров`
  }
];

const steps = [
  "Выберите тур, жильё, еду или товары",
  "Оформите заказ или бронь",
  "Получите подтверждение",
  "Копите баллы и скидки"
];

function getPartnerName(businessId: string) {
  return partners.find((partner) => partner.id === businessId)?.title ?? "KÖL Partner";
}

function getPartnerSlug(businessId: string) {
  return partners.find((partner) => partner.id === businessId)?.slug;
}

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicHeader />

      <section className="relative overflow-hidden border-b border-border/80 bg-gradient-to-br from-surface via-lake-light to-sand-light">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-white/55" />
        <Container className="relative grid min-h-[620px] gap-10 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="space-y-7">
            <div className="flex flex-wrap gap-2">
              <Badge>Иссык-Куль</Badge>
              <Badge variant="info">Travel marketplace</Badge>
              <Badge variant="success">Бронирование и доставка</Badge>
            </div>
            <div className="space-y-5">
              <h1 className="max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
                Весь Иссык-Куль в одной платформе
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-muted">
                Туры, жильё, доставка еды, магазин, акции и бронирование — всё для отдыха
                на Иссык-Куле в одном сервисе.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button>Найти отдых</Button>
              <Button variant="outline">Стать партнёром</Button>
              <a
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-muted shadow-sm transition hover:border-primary hover:text-primary"
                href="/design-system"
              >
                Design System
              </a>
            </div>
          </div>

          <div className="rounded-lg border border-white/70 bg-surface/70 p-4 shadow-soft backdrop-blur">
            <div className="aspect-[4/3] rounded-md bg-gradient-to-br from-lake-dark via-primary to-sand p-5 text-white shadow-card">
              <div className="flex h-full flex-col justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide">Summer preview</p>
                  <h2 className="mt-3 text-3xl font-semibold leading-tight">
                    Чолпон-Ата, Бостери, Каракол и весь берег рядом
                  </h2>
                </div>
                <div className="grid gap-3 rounded-md bg-white/95 p-4 text-foreground shadow-sm sm:grid-cols-3">
                  <div>
                    <p className="text-2xl font-semibold">{tours.length}</p>
                    <p className="text-xs text-muted">туров</p>
                  </div>
                  <div>
                    <p className="text-2xl font-semibold">{stays.length}</p>
                    <p className="text-xs text-muted">объектов жилья</p>
                  </div>
                  <div>
                    <p className="text-2xl font-semibold">{partners.length}</p>
                    <p className="text-xs text-muted">партнёров</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <Container className="space-y-16 py-12">
        <section className="relative z-0 -mt-6 rounded-lg border border-border/90 bg-surface/95 p-4 shadow-soft backdrop-blur lg:p-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.2fr_1fr_0.8fr_0.9fr_auto]">
            <Input placeholder="Куда едем?" />
            <Input placeholder="Даты" />
            <Input placeholder="Гости" />
            <Select defaultValue="all">
              <option value="all">Категория</option>
              <option value="tours">Туры</option>
              <option value="stays">Жильё</option>
              <option value="food">Еда</option>
              <option value="shop">Магазин</option>
            </Select>
            <Button className="w-full xl:w-auto">Найти</Button>
          </div>
        </section>

        <section className="space-y-6">
          <SectionTitle
            description="Быстрый вход в основные сценарии отдыха: выбрать маршрут, забронировать жильё, заказать еду или купить товары."
            eyebrow="Категории"
            title="Что нужно для отдыха"
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => (
              <Card className="transition duration-200 hover:-translate-y-1 hover:shadow-soft" key={category.title}>
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-xl font-semibold">{category.title}</h3>
                    <Badge variant="muted">{category.badge}</Badge>
                  </div>
                  <p className="text-sm leading-6 text-muted">{category.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <SectionTitle
            description="Катера, горячие источники, джип-маршруты и локальные гиды."
            eyebrow="Popular tours"
            title="Популярные туры"
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {tours.slice(0, 3).map((tour) => (
              <TourCard key={tour.id} tour={tour} />
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <SectionTitle
            description="Гостевые дома, отели, коттеджи, юрточные лагеря и виллы."
            eyebrow="Best stays"
            title="Лучшее жильё"
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {stays.slice(0, 3).map((stay, index) => (
              <StayCard key={stay.id} room={rooms[index]} stay={stay} />
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <SectionTitle
            description="Национальная кухня, завтраки, кафе и доставка к месту отдыха."
            eyebrow="Food delivery"
            title="Еда с доставкой"
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {foodItems.slice(0, 3).map((food) => (
              <FoodCard
                food={food}
                key={food.id}
                partnerName={getPartnerName(food.businessId)}
                partnerSlug={getPartnerSlug(food.businessId)}
              />
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <SectionTitle
            description="Продукты, уголь, пляжные товары и сувениры для поездки."
            eyebrow="Shop for vacation"
            title="Магазин для отдыха"
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {products.slice(0, 3).map((product) => (
              <ProductCard
                key={product.id}
                partnerName={getPartnerName(product.businessId)}
                partnerSlug={getPartnerSlug(product.businessId)}
                product={product}
              />
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <SectionTitle
            description="Отели, рестораны, магазины, туроператоры и гиды в единой операционной системе."
            eyebrow="Partners"
            title="Партнёры KÖL"
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {partners.slice(0, 3).map((partner) => (
              <PartnerCard key={partner.id} partner={partner} />
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <SectionTitle
            description="Путь клиента остаётся коротким и понятным, даже когда за сценой работает marketplace."
            eyebrow="How it works"
            title="Как это работает"
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => (
              <Card key={step}>
                <CardContent className="space-y-4 p-5">
                  <Badge>{index + 1}</Badge>
                  <p className="text-base font-semibold leading-7">{step}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="grid gap-6 rounded-lg border border-border bg-surface p-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="space-y-3">
            <Badge variant="info">Для партнёров</Badge>
            <h2 className="text-3xl font-semibold leading-tight">Зарабатывайте с KÖL в сезон</h2>
            <p className="max-w-3xl text-base leading-7 text-muted">
              Подключите отель, ресторан, магазин или туры. Получайте заказы и брони,
              управляйте бизнесом через партнёрский кабинет, CRM и stop-кнопку.
            </p>
          </div>
          <Button>Стать партнёром</Button>
        </section>

        <section className="rounded-lg bg-gradient-to-br from-primary via-secondary to-accent p-6 text-white lg:p-10">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <h2 className="max-w-2xl text-3xl font-semibold leading-tight">
              Начните отдых на Иссык-Куле уже сейчас
            </h2>
            <div className="flex flex-wrap gap-3">
              <Button className="border-white bg-white text-primary hover:opacity-90">
                Смотреть туры
              </Button>
              <Button className="border-white text-white hover:bg-white hover:text-primary" variant="outline">
                Найти жильё
              </Button>
            </div>
          </div>
        </section>
      </Container>

      <PublicFooter />
    </main>
  );
}
