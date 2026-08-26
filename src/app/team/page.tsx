import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Container } from "@/components/ui/Container";
import { presentationMedia } from "@/lib/presentation-media";

const teamWorkspaces = [
  {
    title: "Собственник",
    subtitle: "KÖL Owner",
    description: "Сводка бизнеса, ключевые показатели и переход в рабочие контуры платформы.",
    loginHref: "/login?next=/owner",
    previewHref: "/owner",
    icon: "◆"
  },
  {
    title: "Администратор",
    subtitle: "KÖL Admin",
    description: "Операционный центр: заказы, бронирования, каталог, партнёры, доставка, финансы и AI-диспетчер.",
    loginHref: "/login?next=/admin",
    previewHref: "/admin",
    icon: "◎"
  },
  {
    title: "Партнёр",
    subtitle: "KÖL Partner",
    description: "Заказы, брони, каталог, доступность, промо, отзывы и рабочая аналитика своего бизнеса.",
    loginHref: "/login?next=/partner",
    previewHref: "/partner",
    icon: "◇"
  },
  {
    title: "Курьер",
    subtitle: "KÖL Courier",
    description: "Назначенные доставки, активный маршрут, история, доход и сообщения о проблемах.",
    loginHref: "/login?next=/courier",
    previewHref: "/courier",
    icon: "→"
  }
];

const clientPreview = {
  title: "Клиент",
  subtitle: "KÖL Client",
  description: "Бронирования, заказы, избранное, персональные предложения, лояльность и поддержка.",
  loginHref: "/login?next=/client",
  previewHref: "/client",
  icon: "○"
};

export default function TeamPage() {
  const previewMode = process.env.DATA_SOURCE_MODE !== "supabase";
  const workspaces = previewMode ? [...teamWorkspaces, clientPreview] : teamWorkspaces;

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div
        className="kol-hero-photo absolute inset-0 bg-cover bg-center opacity-35"
        style={{ backgroundImage: `url("${presentationMedia.heroMountain}")` }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-950/92 to-cyan-950/78" />
      <div className="kol-orb absolute -right-20 top-16 h-72 w-72 rounded-full bg-cyan-300/16 blur-3xl" />

      <Container className="relative py-8 sm:py-12 lg:py-16">
        <div className="mx-auto max-w-6xl">
          <div className="kol-reveal flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap gap-2">
                <Badge className="border-white/20 bg-white text-slate-950">{previewMode ? "KÖL Demo" : "Служебный вход"}</Badge>
                {previewMode ? <Badge className="border-cyan-300/30 bg-cyan-300/15 text-cyan-100">Все роли платформы</Badge> : null}
              </div>
              <p className="mt-5 text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200">KÖL Workspace</p>
              <h1 className="mt-3 text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
                {previewMode ? "Посмотрите KÖL глазами каждой роли" : "Вход для команды KÖL"}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-white/72 sm:text-lg">
                {previewMode
                  ? "Пройдите весь путь платформы: клиент выбирает и оформляет, партнёр принимает работу, курьер доставляет, администратор контролирует, собственник видит бизнес целиком."
                  : "Выберите свой рабочий кабинет. После авторизации вы перейдёте прямо в нужное пространство."}
              </p>
            </div>
            <Link
              className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-white/10 px-5 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
              href="/"
            >
              ← Вернуться на сайт
            </Link>
          </div>

          {previewMode ? (
            <div className="kol-reveal-soft mt-7 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4 text-sm leading-6 text-cyan-50 backdrop-blur sm:p-5">
              <strong>Безопасное демо:</strong> кабинеты открываются без рабочих логинов, чтобы показать интерфейсы и сквозной сценарий. Реальные платежи и production-данные не затрагиваются.
            </div>
          ) : null}

          <section className="mt-8 grid gap-4 md:grid-cols-2 lg:mt-10">
            {workspaces.map((workspace, index) => (
              <article
                className="kol-category-card relative overflow-hidden rounded-[1.75rem] border border-white/15 bg-white/10 p-6 shadow-2xl backdrop-blur-xl sm:p-7"
                key={workspace.title}
                style={{ animationDelay: `${index * 90}ms` }}
              >
                <div className="flex items-start justify-between gap-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">{workspace.subtitle}</p>
                    <h2 className="mt-2 text-2xl font-semibold sm:text-3xl">{workspace.title}</h2>
                  </div>
                  <span className="kol-arrow flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-xl font-semibold text-cyan-100">
                    {workspace.icon}
                  </span>
                </div>
                <p className="mt-5 max-w-xl text-sm leading-6 text-white/70 sm:text-base">{workspace.description}</p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {previewMode ? (
                    <Link
                      className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:-translate-y-0.5 hover:bg-cyan-50"
                      href={workspace.previewHref}
                    >
                      Открыть кабинет →
                    </Link>
                  ) : null}
                  <Link
                    className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/25 bg-white/8 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
                    href={workspace.loginHref}
                  >
                    Войти по аккаунту
                  </Link>
                </div>
              </article>
            ))}
          </section>

          <div className="kol-reveal-soft mt-8 rounded-2xl border border-white/12 bg-slate-950/45 p-5 text-sm leading-6 text-white/62 backdrop-blur sm:p-6">
            <strong className="text-white">Одна экосистема — разные права.</strong> В рабочем режиме каждый участник видит только свой контур. Демо показывает интерфейсы рядом, не объединяя реальные полномочия ролей.
          </div>
        </div>
      </Container>
    </main>
  );
}
