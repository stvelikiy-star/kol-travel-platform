import Link from "next/link";
import { requestClientAccessAction } from "@/app/actions/client/onboarding";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { Input } from "@/components/ui/Input";
import { presentationMedia } from "@/lib/presentation-media";

type SearchParams = { error?: string; sent?: string };

const errors: Record<string, string> = {
  name: "Введите имя.",
  phone: "Введите телефон для связи.",
  email: "Введите корректный email.",
  unavailable: "Регистрация временно недоступна. Заявку можно отправить без кабинета.",
  send_failed: "Не удалось отправить ссылку. Проверьте email и попробуйте ещё раз."
};

export default async function RegisterPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const params = await searchParams;
  const error = params?.error ? errors[params.error] : undefined;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <PublicHeader />
      <section className="relative isolate overflow-hidden py-10 sm:py-16">
        <div className="absolute inset-0 bg-cover bg-center opacity-45" style={{ backgroundImage: `url("${presentationMedia.kolBeach}")` }} />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-950/90 to-cyan-950/70" />
        <Container className="relative grid gap-8 lg:grid-cols-[1fr_0.78fr] lg:items-center">
          <div className="hidden max-w-xl lg:block">
            <p className="text-sm font-semibold uppercase tracking-[0.26em] text-cyan-200">Личный кабинет KÖL</p>
            <h1 className="mt-4 text-5xl font-semibold leading-tight">Один шаг — и ваши поездки всегда под рукой.</h1>
            <p className="mt-5 text-lg leading-8 text-white/75">Без сложной регистрации и без нового пароля. Оставьте контакты — мы отправим одноразовую ссылку на email.</p>
          </div>
          <Card className="border-white/20 bg-white/95 text-foreground shadow-2xl">
            <CardHeader>
              <CardTitle className="text-2xl">Создать кабинет</CardTitle>
              <CardDescription>Это необязательно: заявку можно отправить и без кабинета.</CardDescription>
            </CardHeader>
            <CardContent>
              {params?.sent ? (
                <div className="space-y-4 rounded-xl border border-success/30 bg-success/10 p-4 text-sm leading-6" role="status">
                  <p className="font-semibold text-success">Ссылка отправлена.</p>
                  <p>Откройте письмо и вернитесь в KÖL. Пароль создавать не нужно.</p>
                  <Link className="font-semibold text-primary hover:underline" href="/">Вернуться на главную</Link>
                </div>
              ) : (
                <form action={requestClientAccessAction} className="grid gap-4">
                  <label className="grid gap-2 text-sm font-medium">Имя<Input autoComplete="name" name="fullName" placeholder="Как к вам обращаться" required /></label>
                  <label className="grid gap-2 text-sm font-medium">Телефон<Input autoComplete="tel" name="phone" placeholder="+996 ..." required /></label>
                  <label className="grid gap-2 text-sm font-medium">Email<Input autoComplete="email" name="email" placeholder="name@example.com" required type="email" /></label>
                  {error ? <p className="rounded-xl border border-danger/20 bg-danger/5 p-3 text-sm text-danger" role="alert">{error}</p> : null}
                  <Button className="w-full" type="submit">Получить ссылку для входа</Button>
                  <p className="text-xs leading-5 text-muted">Ваши данные используются только для кабинета и связи по заявкам KÖL.</p>
                </form>
              )}
            </CardContent>
          </Card>
        </Container>
      </section>
    </main>
  );
}
