import { ReadOnlyActionPanel } from "@/components/operations/ReadOnlyActionPanel";

export function AdminDeliveryDemoActions() {
  return (
    <ReadOnlyActionPanel
      actions={[
        { label: "Назначить курьера", variant: "primary" },
        { label: "Переназначить курьера", variant: "outline" },
        { label: "Отправить на проверку", variant: "outline" },
        { label: "Закрыть проблему доставки", variant: "danger" },
        { label: "Запросить принудительное завершение", variant: "danger" }
      ]}
      description="Операционные действия администратора требуют атомарной серверной записи, проверки текущего статуса и журналирования."
      note="Режим просмотра: назначения, переназначения и принудительные переходы статуса не симулируются. High-risk операции должны подтверждаться сервером и сохраняться в audit log."
      title="Управление доставкой"
    />
  );
}
