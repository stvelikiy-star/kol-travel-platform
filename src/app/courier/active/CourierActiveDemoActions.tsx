import { ReadOnlyActionPanel } from "@/components/operations/ReadOnlyActionPanel";

export function CourierActiveDemoActions() {
  return (
    <ReadOnlyActionPanel
      actions={[
        { label: "Еду к партнёру", variant: "outline" },
        { label: "Забрал заказ", variant: "secondary" },
        { label: "Еду к клиенту", variant: "outline" },
        { label: "Доставлено", variant: "secondary" }
      ]}
      description="Статус доставки должен меняться только через серверную проверку текущего этапа и прав курьера."
      title="Статус активной доставки"
    />
  );
}
