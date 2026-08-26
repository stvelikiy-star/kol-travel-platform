import { ReadOnlyActionPanel } from "@/components/operations/ReadOnlyActionPanel";

export function PartnerStopDemoActions() {
  return (
    <ReadOnlyActionPanel
      actions={[
        { label: "Пауза новых заказов", variant: "outline" },
        { label: "Остановить весь бизнес", variant: "danger" },
        { label: "Экстренная остановка", variant: "danger" }
      ]}
      description="Остановка спроса и бизнеса требует серверной проверки области действия, ролей и защиты уже принятых заказов и подтверждённых броней."
      note="Режим просмотра: стоп-команды не исполняются локально. Они станут доступны только после подтверждённого backend-контракта, RLS и audit log; уже принятые заказы и подтверждённые брони нельзя отменять этим интерфейсом."
      title="Управление доступностью бизнеса"
    />
  );
}
