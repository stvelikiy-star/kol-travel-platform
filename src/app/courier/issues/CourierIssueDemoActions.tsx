import { ReadOnlyActionPanel } from "@/components/operations/ReadOnlyActionPanel";

export function CourierIssueDemoActions() {
  return (
    <ReadOnlyActionPanel
      actions={[
        { label: "Партнёр не готов", variant: "outline" },
        { label: "Клиент не отвечает", variant: "outline" },
        { label: "Проблема с адресом", variant: "secondary" },
        { label: "Нужен администратор", variant: "danger" }
      ]}
      description="Проблема доставки должна создавать реальное обращение только после серверной записи и привязки к доставке, заказу и курьеру."
      title="Проблемы доставки"
    />
  );
}
