import { signInAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { Input } from "@/components/ui/Input";

type LoginSearchParams = { error?: string; next?: string; signedOut?: string };

const safeMessages: Record<string, string> = {
  missing_credentials: "Введите email и пароль.",
  invalid_credentials: "Неверные данные для входа.",
  auth_unavailable: "Авторизация временно недоступна."
};

export default async function LoginPage({ searchParams }: { searchParams?: Promise<LoginSearchParams> }) {
  const resolvedSearchParams = await searchParams;
  const message = resolvedSearchParams?.error ? safeMessages[resolvedSearchParams.error] : undefined;
  const next = resolvedSearchParams?.next ?? "/";

  return (
    <Container className="py-12 sm:py-16">
      <div className="mx-auto max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Вход в KÖL</CardTitle>
            <CardDescription>Используйте учётную запись вашего кабинета.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={signInAction} className="space-y-4">
              <input name="next" type="hidden" value={next} />
              <label className="block space-y-2 text-sm font-medium">
                <span>Email</span>
                <Input autoComplete="email" name="email" required type="email" />
              </label>
              <label className="block space-y-2 text-sm font-medium">
                <span>Пароль</span>
                <Input autoComplete="current-password" name="password" required type="password" />
              </label>
              {message ? <p className="rounded-md border border-danger/20 bg-danger/5 p-3 text-sm text-danger">{message}</p> : null}
              {resolvedSearchParams?.signedOut ? <p className="text-sm text-muted">Вы вышли из аккаунта.</p> : null}
              <Button className="w-full" type="submit">Войти</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
