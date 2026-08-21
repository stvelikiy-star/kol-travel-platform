import Link from "next/link";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { SectionTitle } from "@/components/ui/SectionTitle";

const marketplace = [
  { href: "/stays", title: "KÖL Stay", description: "Поиск жилья, карточка объекта, номера, доступность и бронирование." },
  { href: "/tours", title: "KÖL Tours", description: "Экскурсии и активности, расписание, свободные места и бронирование." },
  { href: "/food", title: "KÖL Food", description: "Рестораны и кафе, меню, выбор позиций и подготовка заказа." },
  { href: "/shop", title: "KÖL Shop", description: "Локальные магазины, товары, наличие и единый заказ." }
];

const operations = [
  { href: "/client", title: "Клиент", description: "Заказы, бронирования, избранное, предложения и поддержка." },
  { href: "/partner", title: "Партнёр", description: "Заказы, брони, каталог, доступность, доставка и стоп-контроль." },
  { href: "/courier", title: "Курьер", description: "Назначения, активная доставка, история и эскалация проблем." },
  { href: "/admin", title: "Администратор", description: "Единый операционный центр платформы и контроль рисков." }
];

const principles = [
  "Один аккаунт пользователя для четырёх направлений.",
  "Цена, наличие и доступность подтверждаются серверной системой, а не придумываются интерфейсом.",
  "Партнёр управляет своими операциями из собственного кабинета.",
  "Курьерский и платёжный контуры разделены.",
  "Администратор видит заказы, брони, доставки и проблемные ситуации в одном месте."
];

export default function PresentationPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <Container className="space-y-12 py-10 sm:py-14">
        <section className="overflow-hidden rounded-xl border border-border/80 bg-gradient-to-br from-primary via-secondary to-accent p-7 text-white shadow-soft sm:p-10">
          <div className="max-w-4xl">
            <Badge className="border-white/30 bg-white text-primary">KÖL · Issyk-Kul Ecosystem</Badge>
            <h1 className="mt-5 text-4xl font-semibold leading-tight sm:text-6xl">
              Весь отдых на Иссык-Куле в одной экосистеме
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-white/85 sm:text-lg">
              Жильё, туры, еда и локальные покупки объединены единым аккаунтом, операционным ядром и кабинетами для клиента, партнёра, курьера и администратора.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <PresentationButton href="/stays" label="Начать с жилья" primary />
              <PresentationButton href="/admin" label="Открыть админку" />
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <SectionTitle
            eyebrow="Marketplace"
            title="4 направления — один KÖL"
            description="Клиент не переключается между разными сервисами: весь путь находится внутри одной платформы."
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {marketplace.map((item, index) => (
              <PresentationCard key={item.href} {...item} badge={`0${index + 1}`} />
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle>Как выглядит путь клиента</CardTitle>
              <CardDescription>От выбора до управления операцией из личного кабинета.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {[
                "Найти жильё или тур по Иссык-Кулю",
                "Посмотреть актуальное предложение и доступность",
                "Создать бронирование через защищённый серверный контур",
                "Заказать еду или товары внутри той же платформы",
                "Следить за заказами и бронированиями в личном кабинете"
              ].map((step, index) => (
                <div className="flex gap-3 rounded-lg border border-border bg-background p-4" key={step}>
                  <Badge>{index + 1}</Badge>
                  <p className="text-sm font-medium leading-6">{step}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle>Ключевой принцип</CardTitle>
              <CardDescription>Интерфейс показывает продукт, но транзакционная истина остаётся на сервере.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {principles.map((principle) => (
                <div className="rounded-lg bg-background p-4 text-sm font-medium leading-6" key={principle}>
                  {principle}
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="space-y-5">
          <SectionTitle
            eyebrow="Operations"
            title="Четыре рабочих кабинета"
            description="Платформа закрывает не только витрину для туриста, но и внутреннюю работу всей экосистемы."
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {operations.map((item) => (
              <PresentationCard key={item.href} {...item} badge="Кабинет" />
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-surface p-6 shadow-card sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-primary">Рекомендуемый порядок показа</p>
              <h2 className="mt-2 text-2xl font-semibold">Клиент → Партнёр → Курьер → Администратор</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
                Сначала покажите четыре направления и сценарий бронирования, затем — как та же операция проходит через внутренние кабинеты платформы.
              </p>
            </div>
            <PresentationButton href="/client" label="Начать сценарий" primary />
          </div>
        </section>
      </Container>
      <PublicFooter />
    </main>
  );
}

function PresentationCard({
  badge,
  description,
  href,
  title
}: {
  badge: string;
  description: string;
  href: string;
  title: string;
}) {
  return (
    <Link className="group block" href={href}>
      <Card className="h-full transition group-hover:-translate-y-1 group-hover:border-primary group-hover:shadow-soft">
        <CardHeader>
          <Badge className="w-fit" variant="muted">{badge}</Badge>
          <CardTitle className="mt-3">{title}</CardTitle>
          <CardDescription className="leading-6">{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <span className="text-sm font-semibold text-primary">Открыть →</span>
        </CardContent>
      </Card>
    </Link>
  );
}

function PresentationButton({ href, label, primary = false }: { href: string; label: string; primary?: boolean }) {
  return (
    <Link
      className={
        primary
          ? "inline-flex min-h-11 items-center justify-center rounded-md border border-white bg-white px-5 py-2 text-sm font-semibold text-primary shadow-sm transition hover:opacity-90"
          : "inline-flex min-h-11 items-center justify-center rounded-md border border-white/40 bg-white/10 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
      }
      href={href}
    >
      {label}
    </Link>
  );
}
