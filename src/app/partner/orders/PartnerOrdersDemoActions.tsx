import { ReadOnlyActionPanel } from "@/components/operations/ReadOnlyActionPanel";

export function PartnerOrdersDemoActions() {
  return (
    <ReadOnlyActionPanel
      actions={[
        { label: "Принять заказ", variant: "primary" },
        { label: "Готов к выдаче", variant: "secondary" },
        { label: "Сообщить проблему", variant: "outline" }
      ]}
      description="Статусы заказов изменяются только через подтверждённую серверную транзакцию с проверкой роли и записью в журнал действий."
      title="Действия с заказом"
    />
  );
}
