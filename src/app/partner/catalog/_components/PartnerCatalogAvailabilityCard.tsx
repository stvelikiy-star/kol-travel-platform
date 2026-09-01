import { randomUUID } from "node:crypto";
import { partnerCatalogAvailabilityFormAction } from "@/app/actions/partner/partnerCatalog";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import type { PartnerCatalogOperationalStatus } from "@/lib/types/partner-catalog";

type Props = {
  actionResult?: string;
  code?: string;
  itemId: string;
  itemType: "menu_item" | "product";
  operationalReason?: string;
  operationalStatus: PartnerCatalogOperationalStatus;
};

export function PartnerCatalogAvailabilityCard(props: Props) {
  const unavailable = props.operationalStatus === "paused" || props.operationalStatus === "out_of_stock";

  return (
    <Card className={unavailable ? "border-warning/40 bg-warning/10" : "border-success/40 bg-success/10"}>
      <CardHeader>
        <Badge className="w-fit" variant={unavailable ? "warning" : "success"}>{props.operationalStatus}</Badge>
        <CardTitle>Операционная доступность</CardTitle>
        <CardDescription>
          {props.operationalReason || "Позиция доступна для будущих заказов."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {props.actionResult ? (
          <p className={props.actionResult === "success" ? "text-sm font-medium text-success" : "text-sm font-medium text-danger"} role="status">
            {props.actionResult === "success" ? "Изменение сохранено." : `Действие отклонено безопасно${props.code ? `: ${props.code}` : "."}`}
          </p>
        ) : null}
        {unavailable ? (
          <AvailabilityForm action="resume" button="Возобновить продажи" {...props} />
        ) : (
          <>
            <AvailabilityForm action="pause" button="Временно приостановить" {...props} />
            <AvailabilityForm action="out_of_stock" button="Отметить: нет в наличии" {...props} />
          </>
        )}
        <p className="text-xs leading-5 text-muted">Изменение действует только на будущие заказы. Модерация, цена, фактический остаток и принятые заказы не изменяются.</p>
      </CardContent>
    </Card>
  );
}

function AvailabilityForm({ action, button, itemId, itemType }: Props & { action: "pause" | "resume" | "out_of_stock"; button: string }) {
  return (
    <form action={partnerCatalogAvailabilityFormAction} className="grid gap-3">
      <input name="itemType" type="hidden" value={itemType} />
      <input name="itemId" type="hidden" value={itemId} />
      <input name="action" type="hidden" value={action} />
      <input name="requestId" type="hidden" value={randomUUID()} />
      {action !== "resume" ? (
        <label className="grid gap-2 text-sm font-semibold">
          Причина
          <textarea className="min-h-20 rounded-md border border-border bg-background p-3 font-normal" maxLength={500} name="reason" required />
        </label>
      ) : null}
      <Button type="submit" variant={action === "resume" ? "secondary" : "danger"}>{button}</Button>
    </form>
  );
}
