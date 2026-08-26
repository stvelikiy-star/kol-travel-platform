import Link from "next/link";
import { signInAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { Input } from "@/components/ui/Input";
import { sanitizeLoginNextPath } from "@/lib/auth/login-redirect";
import { presentationMedia } from "@/lib/presentation-media";

type LoginSearchParams = { error?: string; next?: string; signedOut?: string };

type Workspace = {
  title: string;
  eyebrow: string;
  description: string;
  next: string;
  team: boolean;
};

const safeMessages: Record<string, string> = {
  missing_credentials: "Введите email и пароль.",
  invalid_credentials: "Неверные данные для входа.",
  auth_unavailable: "Авторизация временно недоступна."
};

function resolveWorkspace(nextValue?: string): Workspace {
  const next = sanitizeLoginNextPath(nextValue);

  if (next === "/owner" || next.startsWith("/owner/")) {
    return { title: "Вход собственника", eyebrow: "KÖL Owner", description: "Сводка бизнеса и доступ к рабочим контурам KÖL.", next, team: true };
  }
  if (next === "/admin" || next.startsWith("/admin/")) {
    return { title: "Вход администратора", eyebrow: "KÖL Admin", description: "Операционный центр заказов, броней, партнёров и рисков.", next, team: true };
  }
  if (next === "/partner" || next.startsWith("/partner/")) {
    return { title: "Вход партнёра", eyebrow: "KÖL Partner", description: "Рабочий кабинет вашего бизнеса на платформе KÖL.", next, team: true };
  }
  if (next === "/courier" || next.startsWith("/courier/")) {
    return { title: "Вход курьера", eyebrow: "KÖL Courier", description: "Доставки, маршруты и рабочие задачи курьера.", next, team: true };
  }
  return { title: "Вход в KÖL", eyebrow: "Личный кабинет", description: "Ваши бронирования, заказы и поездки в одном месте.", next, team: false };
}

export default async function LoginPage({ searchParams }: { searchParams?: Promise<LoginSearchParams> }) {
  const resolvedSearchParams = await searchParams;
  const workspace = resolveWorkspace(resolvedSearchParams?.next);
  const message = resolvedSearchParams?.error ? safeMessages[resolvedSearchParams.error] : undefined;

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div
        className="kol-hero-photo absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url("${presentationMedia.heroMountain}")` }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-950/80 to-cyan-950/60" />
      <div className="kol-orb absolute -right-24 top-8 h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl" />

      <Container className="relative flex min-h-screen items-center py-8 sm:py-12">
        <div className="mx-auto grid w-full max-w-5xl gap-8 lg:grid-cols-[1fr_0.82fr] lg:items-center">
          <section className="kol-reveal hidden max-w-xl lg:block">
            <Link className="inline-flex items-center gap-2 text-sm font-semibold text-white/70 transition hover:text-white" href="/">
              ← KÖL · Иссык-Куль
            </Link>
            <p className="mt-9 text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200">{workspace.eyebrow}</p>
            <h1 className="mt-3 text-5xl font-semibold leading-tight">{workspace.title}</h1>
            <p className="mt-5 text-lg leading-8 text-white/70">{workspace.description}</p>
            <div className="mt-8 max-w-md rounded-2xl border border-white/20 bg-white/10 p-5 text-sm leading-6 text-white/70 backdrop-blur">
              Используйте свою рабочую или клиентскую учётную запись. После авторизации вы перейдёте прямо в выбранный раздел.
            </div>
          </section>

          <div className="kol-search-lift mx-auto w-full max-w-md">
            <Card className="border-white/20 bg-white/95 shadow-2xl backdrop-blur-xl">
              <CardHeader className="space-y-3">
                <Link className="w-fit text-sm font-semibold text-primary lg:hidden" href="/">← На главную</Link>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{workspace.eyebrow}</p>
                  <CardTitle className="mt-2 text-2xl sm:text-3xl">{workspace.title}</CardTitle>
                  <CardDescription className="mt-2 leading-6">{workspace.description}</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <form action={signInAction} className="space-y-4">
                  <input name="next" type="hidden" value={workspace.next} />
                  <label className="block space-y-2 text-sm font-medium">
                    <span>Email</span>
                    <Input autoComplete="email" name="email" placeholder="name@example.com" required type="email" />
                  </label>
                  <label className="block space-y-2 text-sm font-medium">
                    <span>Пароль</span>
                    <Input autoComplete="current-password" name="password" placeholder="Ваш пароль" required type="password" />
                  </label>
                  {message ? <p className="rounded-xl border border-danger/20 bg-danger/5 p-3 text-sm text-danger" role="alert">{message}</p> : null}
                  {resolvedSearchParams?.signedOut ? <p className="text-sm text-muted">Вы вышли из аккаунта.</p> : null}
                  <Button className="w-full" type="submit">Войти</Button>
                </form>

                <div className="mt-5 border-t border-border pt-5 text-center text-sm text-muted">
                  {workspace.team ? (
                    <Link className="font-semibold text-primary hover:underline" href="/team">Другой рабочий кабинет →</Link>
                  ) : (
                    <Link className="font-semibold text-primary hover:underline" href="/team">Работаете в KÖL? Вход для команды →</Link>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </Container>
    </main>
  );
}
