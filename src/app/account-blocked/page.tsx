import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";

export default function Page() {
  return (
    <Container className="py-12 sm:py-16">
      <div className="mx-auto max-w-xl">
        <Card>
          <CardHeader><CardTitle>Аккаунт недоступен</CardTitle><CardDescription>Профиль неактивен или заблокирован. Обратитесь к администратору KÖL.</CardDescription></CardHeader>
          <CardContent><a className="text-sm font-semibold text-primary" href="/">Вернуться на главную</a></CardContent>
        </Card>
      </div>
    </Container>
  );
}
