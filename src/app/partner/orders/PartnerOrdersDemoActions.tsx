import { ReadOnlyActionPanel } from "@/components/operations/ReadOnlyActionPanel";

export function PartnerOrdersDemoActions() {
  return (
    <ReadOnlyActionPanel
      actions={[
        { label: "Принять заказ", variant: "primary" },
        { label: "Готов к выдаче", variant: "secondary" },
        { label: "Сообщить проблему", variant: "outline" }
      ]}
      description="Статусы заказов будут изменяться только через подтверждённую серверную транзакцию с проверкой роли и audit log."
      title="Действия с заказом"
    />
  );
}
