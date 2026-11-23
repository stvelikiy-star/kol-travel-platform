import Link from "next/link";
import { AdminCatalogReviewQueue } from "@/components/admin/AdminCatalogReviewQueue";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { requireSuperAdmin } from "@/lib/auth/roles";
import { getAdminCatalogReviewQueueReadResult } from "@/lib/data/admin-catalog-read";

export const dynamic = "force-dynamic";

export default async function AdminModerationPage() {
  const [result, moderator] = await Promise.all([
    getAdminCatalogReviewQueueReadResult(),
    requireSuperAdmin()
  ]);
  const canModerate = moderator.ok && result.source === "supabase";

  return (
    <AdminLayout status={canModerate && result.ok ? "stable" : "attention"}>
      <Card className="overflow-hidden">
        <div className="bg-linear-to-br from-slate-900 via-primary to-accent p-6 text-white">
          <Badge className="border-white/30 bg-white text-primary">KÖL Moderation</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">Модерация платформы</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
            Реальная очередь проверки каталога подключена к PostgreSQL.
            Решения о публикации и проверке содержимого выполняются через защищённые операции KÖL.
          </p>
        </div>
      </Card>
      <Card className="border-primary/25 bg-lake-light">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
          <div>
            <p className="font-semibold">Модерация каталога</p>
            <p className="text-muted">Одобрять и отклонять позиции на проверке может только владелец платформы.</p>
          </div>
          <Link href="/admin/catalog/review" className="rounded-md border border-primary px-4 py-2 font-semibold text-primary">
            Полная очередь
          </Link>
        </CardContent>
      </Card>
      <AdminCatalogReviewQueue canModerate={canModerate} result={result} />
      <Card className="border-warning/40 bg-warning/10">
        <CardHeader><CardTitle>Остальные направления модерации</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm leading-6 text-muted">
          <p>Жалобы на пользователей, отзывы и сообщения о нарушениях пока не объединены в одну очередь.
            Данные по ним не подменяются демонстрационными записями.</p>
          <p>Изменение статуса отдельной записи каталога не означает автоматическую публикацию
            или отключение партнёра. Эти операции сохраняют собственные серверные правила.</p>
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
