import { ClientLayout } from "@/components/layout/ClientLayout";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

export default function ClientOffersPage() {
  return (
    <ClientLayout>
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-primary via-secondary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">Offers locked</Badge>
          <h2 className="mt-4 text-2xl font-semibold sm:text-3xl">Мои офферы</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
            KÖL не показывает придуманные скидки, промокоды или статус «active/expired». Персональные офферы появятся только из подтверждённого promotions/eligibility backend.
          </p>
        </div>
      </Card>

      <Card className="border-warning/40 bg-warning/10">
        <CardHeader><CardTitle>Промо-механика ещё не подключена</CardTitle><CardDescription>До реального backend нет кнопки «Применить», условных процентов и кодов вроде KOLSUMMER/KOLSHOP.</CardDescription></CardHeader>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Что требуется для offers</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <Requirement>Promotion records с датами действия и scope.</Requirement>
            <Requirement>Eligibility rules для client/account/order/booking.</Requirement>
            <Requirement>Server-side validation перед расчётом цены.</Requirement>
            <Requirement>Auditability и запрет на client-side изменение discount amount.</Requirement>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Каталог остаётся доступен</CardTitle><CardDescription>Без обещания несуществующей скидки.</CardDescription></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <CatalogLink href="/stays">Жильё</CatalogLink>
            <CatalogLink href="/tours">Туры</CatalogLink>
            <CatalogLink href="/food">Еда</CatalogLink>
            <CatalogLink href="/shop">Магазин</CatalogLink>
          </CardContent>
        </Card>
      </div>
    </ClientLayout>
  );
}

function Requirement({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border border-border bg-background p-3 font-medium text-foreground">{children}</div>;
}

function CatalogLink({ children, href }: { children: React.ReactNode; href: string }) {
  return <a className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary" href={href}>{children}</a>;
}
