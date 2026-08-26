import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";

export default function Page() {
  return (
    <Container className="py-12 sm:py-16">
      <div className="mx-auto max-w-xl">
        <Card>
          <CardHeader><CardTitle>Нет доступа</CardTitle><CardDescription>У этой учётной записи нет прав для выбранного раздела.</CardDescription></CardHeader>
          <CardContent><Link className="text-sm font-semibold text-primary" href="/">Вернуться на главную</Link></CardContent>
        </Card>
      </div>
    </Container>
  );
}
