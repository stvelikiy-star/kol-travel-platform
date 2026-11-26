import Link from "next/link";
import {redirect} from "next/navigation";
import {updateOwnAccountEmail,updateOwnAccountPassword} from "@/app/actions/accountSecurity";
import {Badge} from "@/components/ui/Badge";
import {Button} from "@/components/ui/Button";
import {Card,CardContent,CardDescription,CardHeader,CardTitle} from "@/components/ui/Card";
import {Container} from "@/components/ui/Container";
import {createSupabaseServerClient} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
type Params = {result?:string;recovery?:string;email_verified?:string;staff_invite?:string};
const messages: Record<string, string> = {
  password_updated:"Пароль изменён. Используйте новый пароль при следующем входе.",
  password_mismatch:"Новые пароли не совпадают.",
  password_policy:"Пароль должен содержать не менее 12 символов и не более 72 байт.",
  password_rejected:"Supabase отклонил изменение пароля. Проверьте требования безопасности учётной записи.",
  email_confirmation_sent:"Запрос на смену адреса электронной почты принят. Проверьте письма на новом и, при необходимости, прежнем адресе. До подтверждения логин не изменится.",
  email_unchanged:"Вы указали текущий адрес электронной почты.",
  invalid_email:"Введите корректный адрес электронной почты.",
  email_rejected:"Не удалось изменить адрес электронной почты. Проверьте почтовую доставку и требования Supabase.",
  rate_limited:"Слишком много запросов. Повторите позже.",
  configuration_unavailable:"Отправка писем ещё не настроена для этого адреса сайта.",
  unavailable:"Сейчас изменение недоступно. Попробуйте позже."
};

export default async function AccountSecurityPage({searchParams}:{searchParams?:Promise<Params>}) {
  const supabase=await createSupabaseServerClient();
  if(!supabase)redirect("/login?next=%2Faccount%2Fsecurity");
  const {data:{user},error}=await supabase.auth.getUser();
  if(error||!user)redirect("/login?next=%2Faccount%2Fsecurity");

  const params=await searchParams;
  const result=params?.result && Object.hasOwn(messages,params.result) ? messages[params.result] : undefined;
  const displayEmail=user.email||"Электронная почта не указана";
  return <main className="min-h-screen bg-linear-to-br from-background via-lake-light/45 to-sand-light/60">
    <Container className="mx-auto max-w-4xl space-y-6 py-8 sm:py-12">
      <header className="rounded-2xl bg-linear-to-br from-slate-950 via-primary to-secondary p-6 text-white shadow-xl sm:p-8">
        <Badge className="border-white/30 bg-white text-primary">KÖL · Аккаунт</Badge>
        <h1 className="mt-4 text-3xl font-semibold">Логин, пароль и безопасность</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/80">Управляйте только собственной учётной записью. Изменение пароля или адреса электронной почты не меняет вашу роль, права, заказы и бронирования.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/team" className="rounded-lg border border-white/30 px-4 py-2 text-sm font-semibold">К рабочим кабинетам</Link>
          <Link href="/account/mfa" className="rounded-lg border border-white/30 px-4 py-2 text-sm font-semibold">Подключить двухфакторную защиту →</Link>
          <Link href="/" className="rounded-lg border border-white/30 px-4 py-2 text-sm font-semibold">На главную</Link>
        </div>
      </header>

      {(result||params?.recovery||params?.email_verified||params?.staff_invite)&&<Card className="border-primary/30 bg-lake-light">
        <CardContent className="space-y-2 p-4 text-sm leading-6" role="status">
          {params?.staff_invite ? <p>Приглашение принято. Установите пароль ниже, чтобы затем входить в рабочий кабинет по email и паролю.</p> : null}
          {result ? <p>{result}</p> : null}
          {params?.recovery ? <p>Ссылка восстановления принята. Теперь задайте новый пароль ниже.</p> : null}
          {params?.email_verified ? <p>Ссылка подтверждения обработана. Актуальный логин показан ниже.</p> : null}
        </CardContent>
      </Card>}

      <Card>
        <CardHeader>
          <CardTitle>Текущий логин</CardTitle>
          <CardDescription>Для входа в КЁЛь используется адрес электронной почты. Действующий пароль не отображается и не может быть восстановлен.</CardDescription>
        </CardHeader>
        <CardContent>
          <label className="grid gap-2 text-sm font-medium">
            Электронная почта вашей учётной записи
            <input readOnly value={displayEmail} translate="no"
              className="min-h-12 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground" />
          </label>
          <p className="mt-3 text-xs leading-5 text-muted">Пароли хранятся в Supabase Auth в защищённом виде. Их не видит даже администратор.</p>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Сменить пароль</CardTitle>
            <CardDescription>После изменения используйте новый пароль для входа. Никому его не отправляйте.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateOwnAccountPassword} className="grid gap-4">
              <label className="grid gap-2 text-sm font-medium">
                Новый пароль
                <input type="password" name="password" required minLength={12} maxLength={72} autoComplete="new-password"
                  className="min-h-12 w-full rounded-lg border border-border bg-background px-3 py-2" />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Повторите новый пароль
                <input type="password" name="password_confirm" required minLength={12} maxLength={72} autoComplete="new-password"
                  className="min-h-12 w-full rounded-lg border border-border bg-background px-3 py-2" />
              </label>
              <Button type="submit">Изменить пароль</Button>
              <Link href="/forgot-password" className="text-sm font-semibold text-primary hover:underline">Не помню старый пароль →</Link>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Сменить электронную почту (логин)</CardTitle>
            <CardDescription>Новый адрес станет логином только после подтверждения по электронной почте.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateOwnAccountEmail} className="grid gap-4">
              <label className="grid gap-2 text-sm font-medium">
                Новый адрес электронной почты
                <input type="email" name="email" required maxLength={254} autoComplete="email"
                  placeholder="name@example.com" className="min-h-12 w-full rounded-lg border border-border bg-background px-3 py-2" />
              </label>
              <p className="text-xs leading-5 text-muted">
                Для безопасности может понадобиться подтвердить и старый, и новый адрес. Не меняйте адрес электронной почты, если не можете получить письмо.
              </p>
              <Button type="submit">Запросить изменение адреса</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card className="border-warning/30 bg-warning/10">
        <CardHeader><CardTitle>Если письма не приходят</CardTitle></CardHeader>
        <CardContent className="text-sm leading-6">
          <p>Проверьте «Спам» и правильность адреса. Для писем клиентам и сотрудникам необходимо настроить собственный SMTP в Supabase. Без него письма на произвольные адреса могут не отправляться.</p>
          <p className="mt-2">Этот раздел работает только в авторизованной сессии. Пароли и секретные ключи не записываются в базу профилей КЁЛь.</p>
        </CardContent>
      </Card>
    </Container>
  </main>;
}
