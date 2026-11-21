import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";

export default function Page() {
  return (
    <Container className="py-12 sm:py-16">
      <div className="mx-auto max-w-xl">
        <Card>
          <CardHeader><CardTitle>Завершите настройку кабинета</CardTitle><CardDescription>Остался один короткий шаг: KÖL должен сохранить имя и телефон, чтобы показывать ваши заявки и бронирования.</CardDescription></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Link className="inline-flex min-h-11 items-center justify-center rounded-md border border-primary bg-primary px-4 py-2 text-center text-sm font-semibold text-white shadow-sm transition hover:opacity-90" href="/register">Заполнить карточку</Link>
            <Link className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-center text-sm font-semibold text-foreground transition hover:border-primary hover:bg-lake-light hover:text-primary" href="/">Вернуться на главную</Link>
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
