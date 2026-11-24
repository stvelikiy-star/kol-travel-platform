import Link from "next/link";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { getPartnerApplicationsForReview } from "@/lib/data/admin-partner-applications";

export const dynamic = "force-dynamic";

export default async function PartnerApplicationsPage() {
  const result = await getPartnerApplicationsForReview();
  return <AdminLayout status={!result.ok ? "attention" : "stable"}>
    <Card>
      <CardHeader>
        <CardTitle>Заявки новых партнёров</CardTitle>
        <CardDescription>Заявки с формы «Стать партнёром». Это предварительные обращения, не подтверждённые договоры. Права партнёра не выдаются до отдельного решения SUPER ADMIN.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!result.ok ? <p role="alert">Нет подтверждённого доступа к заявкам. Данные не загружены.</p>
          : result.applications.length === 0 ? <p>Новых заявок пока нет.</p>
          : result.applications.map(item => <article key={item.id} className="space-y-3 rounded-lg border border-border p-4">
            <div className="flex flex-wrap justify-between gap-2">
              <h2 className="font-semibold">{item.businessName || item.title}</h2>
              <p className="text-sm text-muted">{item.status} · {item.createdAt.slice(0,10)}</p>
            </div>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div><dt className="text-muted">Контакт</dt><dd>{item.name || "—"}</dd></div>
              <div><dt className="text-muted">Email</dt><dd className="break-all">{item.email || "Не указан"}</dd></div>
              <div><dt className="text-muted">Телефон</dt><dd>{item.phone || "—"}</dd></div>
              <div><dt className="text-muted">Направление</dt><dd>{item.businessType || "—"}</dd></div>
              <div><dt className="text-muted">Локация</dt><dd>{item.location || "—"}</dd></div>
              <div className="sm:col-span-2"><dt className="text-muted">Комментарий</dt><dd className="break-words">{item.comment || "—"}</dd></div>
            </dl>
            <div className="flex flex-wrap items-center gap-3">
              <Link className="rounded-md border border-primary px-3 py-2 text-sm font-semibold" href={"/admin/support?ticket=" + encodeURIComponent(item.id)}>Открыть обращение и начать переговоры</Link>
              <p className="text-xs text-muted">Одобрение и выдача доступа выполняются отдельно после проверки бизнеса.</p>
            </div>
          </article>)}
      </CardContent>
    </Card>
  </AdminLayout>;
}
