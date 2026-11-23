import Link from "next/link";
import {requestAccountPasswordReset} from "@/app/actions/accountSecurity";
import {Badge} from "@/components/ui/Badge";
import {Button} from "@/components/ui/Button";
import {Card,CardContent,CardDescription,CardHeader,CardTitle} from "@/components/ui/Card";
import {Container} from "@/components/ui/Container";

export const dynamic="force-dynamic";
type Params={status?:string};
const errors:Record<string,string>={
  invalid_email:"Укажите правильный адрес электронной почты.",
  configuration_unavailable:"Ссылка восстановления недоступна: не настроен адрес для отправки писем.",
  delivery_unavailable:"Не удалось отправить письмо. Проверьте настройки почтовой доставки.",
  rate_limited:"Слишком много запросов. Повторите позже."
};
export default async function ForgotPasswordPage({searchParams}:{searchParams?:Promise<Params>}) {
  const params=await searchParams;
  const status=params?.status;
  const message=status==="sent"
    ? "Если учётная запись существует и почта настроена, вы получите письмо со ссылкой для смены пароля. Проверьте «Спам»."
    : (status?errors[status]:undefined);
  return <main className="min-h-screen bg-linear-to-br from-slate-950 via-primary to-slate-950 px-4 py-12 text-white">
    <Container className="mx-auto max-w-lg">
      <Link href="/login" className="mb-6 inline-flex text-sm font-semibold text-white/80">← К входу в КЁЛь</Link>
      <Card className="border-white/20 bg-white/95 text-foreground shadow-2xl">
        <CardHeader>
          <Badge variant="info">KÖL · Восстановление</Badge>
          <CardTitle className="text-2xl">Забыли пароль?</CardTitle>
          <CardDescription>Укажите адрес электронной почты для входа. Мы отправим ссылку для установки нового пароля, а не действующий пароль.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {message&&<p role="status" className="rounded-lg border border-border bg-lake-light p-3 text-sm leading-6">{message}</p>}
          <form action={requestAccountPasswordReset} className="grid gap-4">
            <label className="grid gap-2 text-sm font-medium">
              Электронная почта (логин)
              <input type="email" name="email" required maxLength={254} autoComplete="email"
                placeholder="name@example.com" className="min-h-12 rounded-lg border border-border bg-background px-3 py-2"/>
            </label>
            <Button type="submit">Отправить ссылку восстановления</Button>
          </form>
          <p className="text-xs leading-6 text-muted">
            Откройте письмо в том же браузере. Если оно не пришло, проверьте «Спам» и настройки отправки писем.
          </p>
        </CardContent>
      </Card>
    </Container>
  </main>;
}
